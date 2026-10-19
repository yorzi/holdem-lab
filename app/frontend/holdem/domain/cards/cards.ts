export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
export type Rank = (typeof RANKS)[number]

export interface Card {
  readonly rank: Rank
  readonly suit: Suit
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠'
}

export const RANK_SYMBOLS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A'
}

export function createCard(rank: Rank, suit: Suit): Card {
  return { rank, suit }
}

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`
}

export function cardLabel(card: Card): string {
  return `${RANK_SYMBOLS[card.rank]}${SUIT_SYMBOLS[card.suit]}`
}

export function createStandardDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => createCard(rank, suit)))
}

export function sortCardsDescending(cards: readonly Card[]): Card[] {
  return [...cards].sort((left, right) => right.rank - left.rank)
}
