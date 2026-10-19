import { describe, expect, it } from 'vitest'
import { cardKey, createStandardDeck } from '../../../app/frontend/holdem/domain/cards/cards'
import { RNG_ALGORITHM_VERSION, SeededRng, shuffle } from '../../../app/frontend/holdem/domain/rng/seeded-rng'

describe('cards and deterministic randomness', () => {
  it('creates a standard deck with 52 unique cards', () => {
    const deck = createStandardDeck()
    const keys = deck.map(cardKey)

    expect(deck).toHaveLength(52)
    expect(new Set(keys).size).toBe(52)
  })

  it('replays the same shuffle for the same seed', () => {
    const deck = createStandardDeck()
    const first = shuffle(deck, 'training-seed-42')
    const second = shuffle(deck, 'training-seed-42')
    const other = shuffle(deck, 'training-seed-43')

    expect(first).toEqual(second)
    expect(first).not.toEqual(other)
  })

  it('keeps the algorithm version explicit and returns bounded integers', () => {
    const rng = new SeededRng(1234)
    const values = Array.from({ length: 100 }, () => rng.nextInt(7))

    expect(RNG_ALGORITHM_VERSION).toBe('mulberry32-fisher-yates-v1')
    expect(values.every((value) => value >= 0 && value < 7)).toBe(true)
  })
})
