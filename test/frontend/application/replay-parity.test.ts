import { describe, expect, it } from 'vitest'
import {
  deserializeReplay,
  replayDecisionRecord,
  replayFingerprint,
  replayHand,
  replayInputForDecisionRecord,
  serializeReplay,
  UnsupportedReplayVersionError,
  type ReplayStep
} from '../../../app/frontend/holdem/application/replay'
import { createInitialHand as publicCreateInitialHand } from '../../../app/frontend/holdem'
import { applyAction, createInitialHand, getLegalActions, type Street } from '../../../app/frontend/holdem/domain/betting/holdem'
import { createDecisionRecord, type DecisionRecord } from '../../../app/frontend/holdem/domain/records/decision-record'
import { buildStrategyFeedback } from '../../../app/frontend/holdem/strategy/advisory'
import { createTrainingScenario } from '../../../app/frontend/holdem/application/training'

const replaySteps: readonly ReplayStep[] = [
  { actor: 'hero', action: { type: 'call' } },
  { actor: 'villain', action: { type: 'check' } },
  { actor: 'villain', action: { type: 'check' } },
  { actor: 'hero', action: { type: 'check' } },
  { actor: 'villain', action: { type: 'check' } }
]

const scenarioCases: readonly { readonly mode: 'live' | 'quiz' | 'street'; readonly seed: string; readonly focusStreet?: Street }[] = [
  { mode: 'live', seed: 'm12-live' },
  { mode: 'quiz', seed: 'm12-quiz' },
  { mode: 'street', seed: 'm12-preflop', focusStreet: 'preflop' },
  { mode: 'street', seed: 'm12-flop', focusStreet: 'flop' },
  { mode: 'street', seed: 'm12-turn', focusStreet: 'turn' },
  { mode: 'street', seed: 'm12-river', focusStreet: 'river' }
]

function decisionRecord(seed = 'm12-review-replay'): DecisionRecord {
  const state = createInitialHand({ seed, heroSeat: 'button' })
  const legal = getLegalActions(state, 'hero')
  const action = { type: 'raise' as const, amount: legal.raise?.min ?? 300 }
  const raised = applyAction(state, 'hero', action)
  if (!raised.ok) throw new Error(raised.error.message)
  const called = applyAction(raised.state, 'villain', { type: 'call' })
  if (!called.ok) throw new Error(called.error.message)

  return createDecisionRecord({
    id: `${seed}-record`,
    mode: 'live',
    state,
    legalActions: legal,
    action,
    userReason: 'I use the price and position before continuing.',
    confidence: 3,
    feedback: buildStrategyFeedback(state, action),
    errorTags: [],
    resultState: called.state,
    opponentActions: called.state.actionHistory.filter((entry) => entry.actor === 'villain'),
    createdAt: '2026-08-20T00:00:00.000Z'
  })
}

describe('versioned deterministic replay', () => {
  it('exposes the canonical engine through the stable public API', () => {
    expect(publicCreateInitialHand({ seed: 'public-api' })).toEqual(replayHand({ seed: 'public-api', actions: [] }))
  })

  it.each(scenarioCases)('builds deterministic $mode scenarios for $focusStreet', (options) => {
    expect(createTrainingScenario(options)).toEqual(createTrainingScenario(options))
  })

  it('replays the same trace identically without mutating the first result', () => {
    const first = replayHand({ seed: 'repeat', actions: replaySteps })
    const before = replayFingerprint(first)
    const second = replayHand({ seed: 'repeat', actions: replaySteps })

    expect(replayFingerprint(first)).toBe(before)
    expect(replayFingerprint(second)).toBe(before)
  })

  it('round-trips a replay envelope that carries all engine versions', () => {
    const input = { seed: 'serialization', actions: replaySteps }
    const serialized = serializeReplay(input)

    expect(JSON.parse(serialized)).toMatchObject({
      version: 'holdem-replay-v2',
      ruleVersion: 'holdem-rules-v2',
      evaluatorVersion: 'holdem-evaluator-v1',
      rngAlgorithmVersion: 'mulberry32-fisher-yates-v1'
    })
    expect(deserializeReplay(serialized)).toEqual(input)
  })

  it('rebuilds a current decision record from its seed and action trace', () => {
    const record = decisionRecord()
    const input = replayInputForDecisionRecord(record)
    const replay = replayDecisionRecord(record)

    expect(input.actions.map((step) => step.action.type)).toEqual(['raise', 'call'])
    expect(replay.matchesResult).toBe(true)
    expect(replayFingerprint(replay.state)).toBe(replayFingerprint(record.resultState))
  })

  it('reports a mismatch when the immutable result was altered', () => {
    const current = decisionRecord('mismatch')
    const record = { ...current, resultState: { ...current.resultState, pot: current.resultState.pot + 1 } }

    expect(replayDecisionRecord(record).matchesResult).toBe(false)
  })

  it('rejects v1 and mismatched evaluator records instead of routing them to current rules', () => {
    const current = decisionRecord('unsupported')
    const legacy = { ...current, version: 1, ruleVersion: 'holdem-rules-v1' } as unknown as DecisionRecord
    const wrongEvaluator = { ...current, evaluatorVersion: 'holdem-evaluator-v0' } as unknown as DecisionRecord

    expect(() => replayDecisionRecord(legacy)).toThrow(UnsupportedReplayVersionError)
    expect(() => replayDecisionRecord(legacy)).toThrow('DecisionRecord version 1 is not supported')
    expect(() => replayDecisionRecord(wrongEvaluator)).toThrow('Evaluator version holdem-evaluator-v0 is not supported')
  })

  it('rejects replay v1 envelopes without guessing a migration', () => {
    expect(() => deserializeReplay(JSON.stringify({ version: 'holdem-replay-v1', seed: 'legacy', actions: [] }))).toThrow('unsupported or malformed format')
  })
})
