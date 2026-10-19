import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialHand, getLegalActions } from '../../../app/frontend/holdem/domain/betting/holdem'
import { createDecisionRecord, type DecisionRecord } from '../../../app/frontend/holdem/domain/records/decision-record'
import { LocalProgressOutbox, PROGRESS_OUTBOX_FORMAT_VERSION, PROGRESS_OUTBOX_STORAGE_KEY, ResilientProgressRepository, type ImportAcknowledgement } from '../../../app/frontend/holdem/persistence/local-outbox'
import { LocalProgressRepository, type ProgressRepository } from '../../../app/frontend/holdem/persistence/local-progress'
import { buildStrategyFeedback } from '../../../app/frontend/holdem/strategy/advisory'

function decisionRecord(id = 'record-001'): DecisionRecord {
  const state = createInitialHand({ seed: id })
  const action = { type: 'call' as const }
  return createDecisionRecord({
    id,
    mode: 'quiz',
    state,
    legalActions: getLegalActions(state, 'hero'),
    action,
    userReason: 'I continue with the price and position.',
    confidence: 3,
    feedback: buildStrategyFeedback(state, action),
    errorTags: [],
    resultState: state,
    opponentActions: [],
    createdAt: '2026-08-19T00:00:00.000Z'
  })
}

describe('versioned local progress outbox', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stores a complete pending record in a versioned envelope', async () => {
    const outbox = new LocalProgressOutbox(window.localStorage)
    const record = decisionRecord()

    await outbox.enqueue(record)

    expect(JSON.parse(window.localStorage.getItem(PROGRESS_OUTBOX_STORAGE_KEY) as string)).toMatchObject({
      version: PROGRESS_OUTBOX_FORMAT_VERSION,
      entries: [{ id: record.id, state: 'pending', record }]
    })
    expect(outbox.pendingRecords()).toEqual([record])
  })

  it('keeps a synced marker after an accepted, duplicate, or claimed acknowledgement', async () => {
    const outbox = new LocalProgressOutbox(window.localStorage)
    const record = decisionRecord()

    await outbox.enqueue(record)
    outbox.markSynced([record.id])

    expect(outbox.pendingRecords()).toEqual([])
    expect(outbox.entryFor(record.id)).toMatchObject({ id: record.id, state: 'synced', fingerprint: expect.any(String) })
    expect(outbox.entryFor(record.id)?.record).toBeUndefined()
  })

  it('does not requeue an unchanged synced record, but requeues changed content', async () => {
    const outbox = new LocalProgressOutbox(window.localStorage)
    const record = decisionRecord()

    await outbox.enqueue(record)
    outbox.markSynced([record.id])
    await outbox.ensureRecords([record])
    expect(outbox.entryFor(record.id)?.state).toBe('synced')

    const changed = { ...record, userReason: 'The price changed my decision.' }
    await outbox.ensureRecords([changed])
    expect(outbox.pendingRecords()).toEqual([changed])
  })

  it('restores the previous outbox entry when the local write fails', async () => {
    const outbox = new LocalProgressOutbox(window.localStorage)
    const failingLocal: ProgressRepository = {
      saveDecision: vi.fn().mockRejectedValue(new Error('local storage failed')),
      listReviews: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined)
    }
    const repository = new ResilientProgressRepository(failingLocal, outbox)

    await expect(repository.saveDecision(decisionRecord())).rejects.toThrow('local storage failed')
    expect(outbox.listEntries()).toEqual([])
  })

  it('queues local records for explicit import and only marks acknowledged ids', async () => {
    const local = new LocalProgressRepository(window.localStorage)
    const outbox = new LocalProgressOutbox(window.localStorage)
    const repository = new ResilientProgressRepository(local, outbox)
    const record = decisionRecord()
    const acknowledgement: ImportAcknowledgement = { accepted: [], duplicates: [], claimed: [record.id] }

    await repository.saveDecision(record)
    expect(repository.pendingImportCount()).toBe(1)
    expect(outbox.entryFor(record.id)?.record).toBeUndefined()
    expect(await repository.queueForImport([record])).toEqual([record])
    repository.markImported({ accepted: [], duplicates: [] })
    expect(repository.pendingImportCount()).toBe(1)
    repository.markImported(acknowledgement)

    expect(repository.pendingImportCount()).toBe(0)
    expect(await repository.listReviews()).toEqual([record])
  })
})
