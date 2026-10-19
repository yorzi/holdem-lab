import { Card, createStandardDeck, RANK_SYMBOLS, sortCardsDescending } from '../cards/cards'
import { shuffle } from '../rng/seeded-rng'
import { evaluateBestHand, HandCategory } from '../showdown/hand-evaluator'

export const CARD_RECOGNITION_VERSION = 'card-recognition-v1'

export type PreflopHandType = 'pair' | 'suited' | 'offsuit'

function sortedPair(cards: readonly Card[]): readonly [Card, Card] {
  if (cards.length !== 2) throw new RangeError('A starting hand requires exactly two cards')
  const sorted = sortCardsDescending(cards)
  return [sorted[0], sorted[1]]
}

export function classifyPreflopHand(cards: readonly Card[]): PreflopHandType {
  const [high, low] = sortedPair(cards)
  if (high.rank === low.rank) return 'pair'
  return high.suit === low.suit ? 'suited' : 'offsuit'
}

export function handNotation(cards: readonly Card[]): string {
  const [high, low] = sortedPair(cards)
  const highSymbol = RANK_SYMBOLS[high.rank]
  const lowSymbol = RANK_SYMBOLS[low.rank]
  if (high.rank === low.rank) return `${highSymbol}${lowSymbol}`
  return `${highSymbol}${lowSymbol}${high.suit === low.suit ? 's' : 'o'}`
}

function uniqueChoices(seed: string, correct: string, candidates: readonly string[]): readonly string[] {
  const choices = [...new Set([correct, ...candidates])]
  return shuffle(choices, `${seed}:choices`).slice(0, Math.min(4, choices.length))
}

export interface StartingHandQuestion {
  readonly id: string
  readonly cards: readonly [Card, Card]
  readonly answer: string
  readonly handType: PreflopHandType
  readonly choices: readonly string[]
}

export function createStartingHandQuestion(seed: string): StartingHandQuestion {
  const cards = sortedPair(shuffle(createStandardDeck(), `${seed}:cards`).slice(0, 2))
  const answer = handNotation(cards)
  const high = RANK_SYMBOLS[cards[0].rank]
  const low = RANK_SYMBOLS[cards[1].rank]
  const suffix = cards[0].suit === cards[1].suit ? 's' : 'o'
  const candidates = cards[0].rank === cards[1].rank
    ? [`${high}${low}s`, `${high}${low}o`, `${high}`]
    : [`${high}${low}${suffix === 's' ? 'o' : 's'}`, `${low}${high}${suffix}`, `${high}${low}`]

  return {
    id: `starting-hand-${seed}`,
    cards,
    answer,
    handType: classifyPreflopHand(cards),
    choices: uniqueChoices(seed, answer, candidates)
  }
}

export interface BestFiveQuestion {
  readonly id: string
  readonly holeCards: readonly [Card, Card]
  readonly board: readonly Card[]
  readonly answer: HandCategory
  readonly bestCards: readonly Card[]
}

export function createBestFiveQuestion(seed: string): BestFiveQuestion {
  const cards = shuffle(createStandardDeck(), `${seed}:cards`).slice(0, 7)
  const rank = evaluateBestHand(cards)
  return {
    id: `best-five-${seed}`,
    holeCards: [cards[0], cards[1]],
    board: cards.slice(2),
    answer: rank.category,
    bestCards: rank.cards
  }
}
