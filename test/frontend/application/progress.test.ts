import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialHand, getLegalActions } from '../../../app/frontend/holdem/domain/betting/holdem'
import { createDecisionRecord, type DecisionRecord, type ErrorTag } from '../../../app/frontend/holdem/domain/records/decision-record'
import { buildStrategyFeedback } from '../../../app/frontend/holdem/strategy/advisory'
import { hasLegacyProgress, LEGACY_PROGRESS_STORAGE_KEY, LocalProgressRepository, PROGRESS_FORMAT_VERSION, PROGRESS_STORAGE_KEY } from '../../../app/frontend/holdem/persistence/local-progress'

function decisionRecord(id: string, createdAt: string, mode: 'live' | 'street' = 'live', errorTags: readonly ErrorTag[] = []): DecisionRecord {
  const state = createInitialHand({ seed: id })
  const action = { type: 'call' as const }
  return createDecisionRecord({
    id,
    mode,
    state,
    legalActions: getLegalActions(state, 'hero'),
    action,
    userReason: 'test reason',
    confidence: 3,
    feedback: buildStrategyFeedback(state, action),
    errorTags,
    resultState: state,
    opponentActions: [],
    createdAt
  })
}

describe('versioned local progress repository', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips records, sorts newest first, and filters the review queue', async () => {
    const repository = new LocalProgressRepository(window.localStorage)
    const older = decisionRecord('older', '2026-08-19T00:00:00.000Z', 'live')
    const newer = decisionRecord('newer', '2026-08-19T01:00:00.000Z', 'street', ['over_calling'])

    await repository.saveDecision(older)
    await repository.saveDecision(newer)

    expect(await repository.listReviews()).toEqual([newer, older])
    expect(await repository.listReviews({ mode: 'street' })).toEqual([newer])
    expect(await repository.listReviews({ errorTag: 'over_calling' })).toEqual([newer])
    expect(await repository.listReviews({ limit: 1 })).toEqual([newer])
  })

  it('uses the client record id as an idempotency key', async () => {
    const repository = new LocalProgressRepository(window.localStorage)
    const first = decisionRecord('same-id', '2026-08-19T00:00:00.000Z')
    const replacement = { ...decisionRecord('same-id', '2026-08-19T02:00:00.000Z'), userReason: 'replacement' }

    await repository.saveDecision(first)
    await repository.saveDecision(replacement)

    expect(await repository.listReviews()).toEqual([replacement])
  })

  it('rejects malformed or unknown progress versions without guessing', async () => {
    const repository = new LocalProgressRepository(window.localStorage)
    const record = decisionRecord('versioned', '2026-08-19T00:00:00.000Z')

    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 'holdem-progress-v3', records: [record] }))
    expect(await repository.listReviews()).toEqual([])

    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: PROGRESS_FORMAT_VERSION, records: [{ id: 'malformed' }] }))
    expect(await repository.listReviews()).toEqual([])

    window.localStorage.setItem(PROGRESS_STORAGE_KEY, 'not json')
    expect(await repository.listReviews()).toEqual([])
  })

  it('rejects a current-version record with a malformed game-state collection', async () => {
    const repository = new LocalProgressRepository(window.localStorage)
    const record = decisionRecord('malformed-state', '2026-08-19T00:00:00.000Z')
    const malformed = { ...record, resultState: { ...record.resultState, actionHistory: null } }

    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ version: PROGRESS_FORMAT_VERSION, records: [malformed] }))

    expect(await repository.listReviews()).toEqual([])
  })

  // 300 sequential saves each re-validate and re-serialize the whole growing
  // list; on slower CI runners this legitimately exceeds vitest's 5s default.
  it('refuses to silently evict records when local history reaches its bound', async () => {
    const repository = new LocalProgressRepository(window.localStorage)

    for (let index = 0; index < 300; index += 1) {
      const createdAt = new Date(Date.UTC(2026, 7, 19, 0, index)).toISOString()
      await repository.saveDecision(decisionRecord(`bounded-${index}`, createdAt))
    }

    const createdAt = new Date(Date.UTC(2026, 7, 19, 0, 300)).toISOString()
    await expect(repository.saveDecision(decisionRecord('bounded-300', createdAt))).rejects.toThrow('existing records were not changed')

    const records = await repository.listReviews()
    expect(records).toHaveLength(300)
    expect(records[0]?.id).toBe('bounded-299')
    expect(records.some((record) => record.id === 'bounded-0')).toBe(true)
    expect(records.some((record) => record.id === 'bounded-300')).toBe(false)
  }, 20000)

  it('detects but never mutates or loads legacy v1 progress', async () => {
    const repository = new LocalProgressRepository(window.localStorage)
    const legacyPayload = JSON.stringify({ version: 'holdem-progress-v1', records: [{ version: 1, id: 'legacy' }] })
    window.localStorage.setItem(LEGACY_PROGRESS_STORAGE_KEY, legacyPayload)

    expect(hasLegacyProgress(window.localStorage)).toBe(true)
    expect(await repository.listReviews()).toEqual([])
    expect(window.localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY)).toBe(legacyPayload)
  })
})
