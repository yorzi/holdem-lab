import { describe, expect, it } from 'vitest'
import { createCard } from '../../../app/frontend/holdem/domain/cards/cards'
import {
  classifyPreflopHand,
  createBestFiveQuestion,
  createStartingHandQuestion,
  handNotation
} from '../../../app/frontend/holdem/domain/drills/card-recognition'

describe('reviewed card-recognition drills', () => {
  it('uses objective, language-neutral starting-hand notation', () => {
    const suited = [createCard(14, 'spades'), createCard(13, 'spades')] as const
    const pair = [createCard(12, 'hearts'), createCard(12, 'clubs')] as const

    expect(handNotation(suited)).toBe('AKs')
    expect(classifyPreflopHand(suited)).toBe('suited')
    expect(handNotation(pair)).toBe('QQ')
    expect(classifyPreflopHand(pair)).toBe('pair')
  })

  it('builds deterministic notation questions with one valid answer', () => {
    const first = createStartingHandQuestion('recognition-001')
    const second = createStartingHandQuestion('recognition-001')

    expect(first).toEqual(second)
    expect(first.choices.filter((choice) => choice === first.answer)).toHaveLength(1)
    expect(first.choices).toContain(first.answer)
  })

  it('derives best-five answers from the versioned evaluator without strategy scoring', () => {
    const first = createBestFiveQuestion('best-five-001')
    const second = createBestFiveQuestion('best-five-001')

    expect(first).toEqual(second)
    expect(first.holeCards).toHaveLength(2)
    expect(first.board).toHaveLength(5)
    expect(first.bestCards).toHaveLength(5)
    expect(first).not.toHaveProperty('equity')
    expect(first).not.toHaveProperty('recommendedAction')
  })
})
