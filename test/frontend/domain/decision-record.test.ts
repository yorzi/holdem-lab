import { describe, expect, it } from 'vitest'
import { createInitialHand, getLegalActions } from '../../../app/frontend/holdem/domain/betting/holdem'
import { createDecisionRecord } from '../../../app/frontend/holdem/domain/records/decision-record'
import { buildStrategyFeedback } from '../../../app/frontend/holdem/strategy/advisory'
import { HAND_EVALUATOR_VERSION, HOLDEM_RULES_VERSION } from '../../../app/frontend/holdem/domain/versions'

describe('decision record boundaries', () => {
  it('requires the caller to provide a stable timestamp instead of reading the system clock', () => {
    const state = createInitialHand({ seed: 'decision-record-boundary' })
    const legalActions = getLegalActions(state, 'hero')
    const feedback = buildStrategyFeedback(state, { type: 'call' })
    const createdAt = '2026-08-19T00:00:00.000Z'

    const record = createDecisionRecord({
      id: 'decision-record-boundary-1',
      mode: 'live',
      state,
      legalActions,
      action: { type: 'call' },
      userReason: 'test fixture',
      confidence: 3,
      feedback,
      errorTags: [],
      resultState: state,
      opponentActions: [],
      createdAt
    })

    expect(record.createdAt).toBe(createdAt)
    expect(record.id).toBe('decision-record-boundary-1')
    expect(record.version).toBe(2)
    expect(record.heroPosition).toBe('button')
    expect(record.ruleVersion).toBe(HOLDEM_RULES_VERSION)
    expect(record.evaluatorVersion).toBe(HAND_EVALUATOR_VERSION)
  })
})
