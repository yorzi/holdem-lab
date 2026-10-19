import { describe, expect, it } from 'vitest'
import { applyUserActionAndOpponent, createTrainingScenario } from '../../../app/frontend/holdem/application/training'
import { getLegalActions } from '../../../app/frontend/holdem/domain/betting/holdem'

describe('training scenarios', () => {
  it.each(['preflop', 'flop', 'turn', 'river'] as const)('drives a deterministic hero decision to %s', (street) => {
    const first = createTrainingScenario({ mode: 'street', seed: `focus-${street}`, focusStreet: street })
    const second = createTrainingScenario({ mode: 'street', seed: `focus-${street}`, focusStreet: street })

    expect(first.state.street).toBe(street)
    expect(first.state.currentActor).toBe('hero')
    expect(first.state).toEqual(second.state)
  })

  it('lets a user action flow through the engine and a deterministic opponent response', () => {
    const scenario = createTrainingScenario({ mode: 'live', seed: 'opponent-flow' })
    const legal = getLegalActions(scenario.state, 'hero')
    const result = applyUserActionAndOpponent(scenario.state, legal.call !== null ? { type: 'call' } : { type: 'check' })

    expect(result.state.currentActor).toBe('hero')
    expect(result.state.street).toBe('flop')
    expect(result.opponentActions.some((entry) => entry.actor === 'villain')).toBe(true)
  })

  it('keeps quiz spots on the same deterministic engine contract', () => {
    const first = createTrainingScenario({ mode: 'quiz', seed: 'quiz-spot-001' })
    const second = createTrainingScenario({ mode: 'quiz', seed: 'quiz-spot-001' })

    expect(first.mode).toBe('quiz')
    expect(first.focusStreet).toBe('preflop')
    expect(first.state).toEqual(second.state)
    expect(first.opponentDescription).toContain('Deterministic')
  })
})
