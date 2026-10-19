import { Card, Rank, RANK_SYMBOLS, sortCardsDescending } from '../cards/cards'

export type HandCategory =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'

export const HAND_CATEGORY_VALUES: Record<HandCategory, number> = {
  'high-card': 0,
  pair: 1,
  'two-pair': 2,
  'three-of-a-kind': 3,
  straight: 4,
  flush: 5,
  'full-house': 6,
  'four-of-a-kind': 7,
  'straight-flush': 8
}

export const HAND_CATEGORY_LABELS: Record<HandCategory, string> = {
  'high-card': 'High card',
  pair: 'Pair',
  'two-pair': 'Two pair',
  'three-of-a-kind': 'Three of a kind',
  straight: 'Straight',
  flush: 'Flush',
  'full-house': 'Full house',
  'four-of-a-kind': 'Four of a kind',
  'straight-flush': 'Straight flush'
}

export interface HandRank {
  readonly category: HandCategory
  readonly categoryValue: number
  readonly tiebreakers: readonly number[]
  readonly cards: readonly Card[]
}

function compareNumberLists(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0
    const rightValue = right[index] ?? 0
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1
    }
  }
  return 0
}

export function compareHandRanks(left: HandRank, right: HandRank): number {
  if (left.categoryValue !== right.categoryValue) {
    return left.categoryValue > right.categoryValue ? 1 : -1
  }
  return compareNumberLists(left.tiebreakers, right.tiebreakers)
}

function makeRank(category: HandCategory, tiebreakers: number[], cards: readonly Card[]): HandRank {
  return {
    category,
    categoryValue: HAND_CATEGORY_VALUES[category],
    tiebreakers,
    cards: [...cards]
  }
}

function findStraightHigh(ranks: readonly number[]): number | null {
  const uniqueRanks = [...new Set(ranks)]
  for (let high = 14; high >= 5; high -= 1) {
    const needed = high === 5 ? [14, 2, 3, 4, 5] : [high - 4, high - 3, high - 2, high - 1, high]
    if (needed.every((rank) => uniqueRanks.includes(rank))) {
      return high
    }
  }
  return null
}

function cardsForStraight(cards: readonly Card[], high: number): Card[] {
  const needed = high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4]
  return needed.map((rank) => cards.find((card) => card.rank === rank) as Card)
}

function cardsForRanks(cards: readonly Card[], ranks: readonly number[]): Card[] {
  const remaining = [...cards]
  return ranks.flatMap((rank) => {
    const index = remaining.findIndex((card) => card.rank === rank)
    if (index < 0) {
      return []
    }
    const [card] = remaining.splice(index, 1)
    return card ? [card] : []
  })
}

export function evaluateFiveCardHand(cards: readonly Card[]): HandRank {
  if (cards.length !== 5) {
    throw new RangeError('A five-card hand must contain exactly five cards')
  }

  const sortedCards = sortCardsDescending(cards)
  const ranks = sortedCards.map((card) => card.rank)
  const counts = new Map<number, number>()
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1)
  }

  const flush = cards.every((card) => card.suit === cards[0].suit)
  const straightHigh = findStraightHigh(ranks)

  if (flush && straightHigh !== null) {
    return makeRank('straight-flush', [straightHigh], cardsForStraight(cards, straightHigh))
  }

  const quads = [...counts.entries()]
    .filter(([, count]) => count === 4)
    .map(([rank]) => rank)
    .sort((left, right) => right - left)
  if (quads.length > 0) {
    const quadRank = quads[0]
    const kicker = ranks.find((rank) => rank !== quadRank) as number
    return makeRank('four-of-a-kind', [quadRank, kicker], cardsForRanks(cards, [quadRank, quadRank, quadRank, quadRank, kicker]))
  }

  const trips = [...counts.entries()]
    .filter(([, count]) => count === 3)
    .map(([rank]) => rank)
    .sort((left, right) => right - left)
  const pairs = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([rank]) => rank)
    .sort((left, right) => right - left)
  if (trips.length > 0 && pairs.length >= 2) {
    const tripRank = trips[0]
    const pairRank = pairs.find((rank) => rank !== tripRank) as number
    return makeRank('full-house', [tripRank, pairRank], cardsForRanks(cards, [tripRank, tripRank, tripRank, pairRank, pairRank]))
  }

  if (flush) {
    return makeRank('flush', ranks, sortedCards)
  }

  if (straightHigh !== null) {
    return makeRank('straight', [straightHigh], cardsForStraight(cards, straightHigh))
  }

  if (trips.length > 0) {
    const tripRank = trips[0]
    const kickers = ranks.filter((rank) => rank !== tripRank).slice(0, 2)
    return makeRank('three-of-a-kind', [tripRank, ...kickers], cardsForRanks(cards, [tripRank, tripRank, tripRank, ...kickers]))
  }

  if (pairs.length >= 2) {
    const [highPair, lowPair] = pairs
    const kicker = ranks.find((rank) => rank !== highPair && rank !== lowPair) as number
    return makeRank('two-pair', [highPair, lowPair, kicker], cardsForRanks(cards, [highPair, highPair, lowPair, lowPair, kicker]))
  }

  if (pairs.length === 1) {
    const pairRank = pairs[0]
    const kickers = ranks.filter((rank) => rank !== pairRank).slice(0, 3)
    return makeRank('pair', [pairRank, ...kickers], cardsForRanks(cards, [pairRank, pairRank, ...kickers]))
  }

  return makeRank('high-card', ranks, sortedCards)
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = []
  const current: T[] = []

  function visit(start: number): void {
    if (current.length === size) {
      result.push([...current])
      return
    }
    const remaining = size - current.length
    for (let index = start; index <= items.length - remaining; index += 1) {
      current.push(items[index])
      visit(index + 1)
      current.pop()
    }
  }

  visit(0)
  return result
}

export function evaluateBestHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5) {
    throw new RangeError('Hold’em evaluation requires at least five cards')
  }

  let best: HandRank | null = null
  for (const candidate of combinations(cards, 5)) {
    const rank = evaluateFiveCardHand(candidate)
    if (best === null || compareHandRanks(rank, best) > 0) {
      best = rank
    }
  }
  return best as HandRank
}

export function formatRank(rank: Rank): string {
  return RANK_SYMBOLS[rank]
}

export function handCategoryLabel(category: HandCategory): string {
  return HAND_CATEGORY_LABELS[category]
}
