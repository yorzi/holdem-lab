import { describe, expect, it } from 'vitest'
import { Card, createCard } from '../../../app/frontend/holdem/domain/cards/cards'
import { compareHandRanks, evaluateBestHand, evaluateFiveCardHand, handCategoryLabel } from '../../../app/frontend/holdem/domain/showdown/hand-evaluator'

const c = (rank: Card['rank'], suit: Card['suit']): Card => createCard(rank, suit)

describe('Hold’em hand evaluator', () => {
  it.each([
    ['high-card', [c(14, 'spades'), c(11, 'hearts'), c(8, 'clubs'), c(5, 'diamonds'), c(2, 'spades')]],
    ['pair', [c(14, 'spades'), c(14, 'hearts'), c(8, 'clubs'), c(5, 'diamonds'), c(2, 'spades')]],
    ['two-pair', [c(14, 'spades'), c(14, 'hearts'), c(8, 'clubs'), c(8, 'diamonds'), c(2, 'spades')]],
    ['three-of-a-kind', [c(14, 'spades'), c(14, 'hearts'), c(14, 'clubs'), c(8, 'diamonds'), c(2, 'spades')]],
    ['straight', [c(14, 'spades'), c(2, 'hearts'), c(3, 'clubs'), c(4, 'diamonds'), c(5, 'spades')]],
    ['flush', [c(14, 'hearts'), c(11, 'hearts'), c(8, 'hearts'), c(5, 'hearts'), c(2, 'hearts')]],
    ['full-house', [c(14, 'spades'), c(14, 'hearts'), c(14, 'clubs'), c(8, 'diamonds'), c(8, 'spades')]],
    ['four-of-a-kind', [c(14, 'spades'), c(14, 'hearts'), c(14, 'clubs'), c(14, 'diamonds'), c(8, 'spades')]],
    ['straight-flush', [c(9, 'hearts'), c(8, 'hearts'), c(7, 'hearts'), c(6, 'hearts'), c(5, 'hearts')]]
  ])('recognizes %s', (expected, cards) => {
    expect(evaluateFiveCardHand(cards).category).toBe(expected)
  })

  it('chooses the best five cards from seven cards', () => {
    const rank = evaluateBestHand([
      c(14, 'spades'),
      c(14, 'hearts'),
      c(13, 'clubs'),
      c(13, 'diamonds'),
      c(2, 'spades'),
      c(9, 'spades'),
      c(7, 'spades')
    ])

    expect(rank.category).toBe('two-pair')
    expect(rank.tiebreakers).toEqual([14, 13, 9])
  })

  it('uses kickers and wheel ordering when comparing hands', () => {
    const acePair = evaluateFiveCardHand([c(14, 'spades'), c(14, 'hearts'), c(13, 'clubs'), c(9, 'diamonds'), c(2, 'spades')])
    const queenPair = evaluateFiveCardHand([c(14, 'clubs'), c(14, 'diamonds'), c(12, 'clubs'), c(9, 'hearts'), c(2, 'diamonds')])
    const wheel = evaluateFiveCardHand([c(14, 'spades'), c(2, 'hearts'), c(3, 'clubs'), c(4, 'diamonds'), c(5, 'spades')])
    const sixHighStraight = evaluateFiveCardHand([c(6, 'spades'), c(5, 'hearts'), c(4, 'clubs'), c(3, 'diamonds'), c(2, 'spades')])

    expect(compareHandRanks(acePair, queenPair)).toBe(1)
    expect(wheel.tiebreakers).toEqual([5])
    expect(compareHandRanks(sixHighStraight, wheel)).toBe(1)
  })

  it('handles a tie when the public board is the best hand', () => {
    const board = [c(14, 'spades'), c(13, 'hearts'), c(12, 'clubs'), c(11, 'diamonds'), c(10, 'spades')]
    const first = evaluateBestHand([...board, c(2, 'hearts'), c(3, 'clubs')])
    const second = evaluateBestHand([...board, c(4, 'hearts'), c(5, 'clubs')])

    expect(first.category).toBe('straight')
    expect(compareHandRanks(first, second)).toBe(0)
  })

  it('keeps the rank payload language-neutral and localizes at display time', () => {
    const rank = evaluateFiveCardHand([c(14, 'spades'), c(14, 'hearts'), c(8, 'clubs'), c(5, 'diamonds'), c(2, 'spades')])

    expect(rank).not.toHaveProperty('categoryLabel')
    expect(handCategoryLabel(rank.category)).toBe('Pair')
  })
})
