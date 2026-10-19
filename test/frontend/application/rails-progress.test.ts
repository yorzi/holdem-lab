import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialHand, getLegalActions } from '../../../app/frontend/holdem/domain/betting/holdem'
import { createDecisionRecord, type DecisionRecord } from '../../../app/frontend/holdem/domain/records/decision-record'
import { buildStrategyFeedback } from '../../../app/frontend/holdem/strategy/advisory'
import { IMPORT_FORMAT_VERSION, RailsProgressImportError, RailsProgressImporter } from '../../../app/frontend/holdem/persistence/rails-progress'

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

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('explicit Rails progress importer', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="csrf-token" content="csrf-test-token">'
  })

  it('posts a versioned envelope with same-origin credentials and CSRF', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      version: IMPORT_FORMAT_VERSION,
      accepted: ['record-001'],
      duplicates: [],
      conflicts: []
    }))
    const record = decisionRecord()
    const importer = new RailsProgressImporter({ installationId: 'install-001', fetchImpl })

    await expect(importer.importRecords([record])).resolves.toEqual({
      version: IMPORT_FORMAT_VERSION,
      accepted: ['record-001'],
      duplicates: [],
      conflicts: []
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [endpoint, init] = fetchImpl.mock.calls[0]
    expect(endpoint).toBe('/api/v1/imports/local_progress')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('same-origin')
    expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-test-token')
    expect(JSON.parse(String(init?.body))).toEqual({
      version: 'holdem-progress-v2',
      installation_id: 'install-001',
      records: [record]
    })
  })

  it('preserves claimed ids when an anonymous record is linked to the signed-in account', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      version: IMPORT_FORMAT_VERSION,
      accepted: [],
      duplicates: [],
      claimed: ['record-001'],
      conflicts: []
    }))
    const importer = new RailsProgressImporter({ installationId: 'install-001', fetchImpl })

    await expect(importer.importRecords([decisionRecord()])).resolves.toMatchObject({ claimed: ['record-001'] })
  })

  it('does not make a request for malformed local records', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const importer = new RailsProgressImporter({ installationId: 'install-001', fetchImpl })

    await expect(importer.importRecords([{ id: 'malformed' } as unknown as DecisionRecord])).rejects.toThrow('Every local progress record must match the persisted DecisionRecord schema')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces server conflicts without hiding the original records', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({
      error: { code: 'client_id_conflict', message: 'A client record id already exists with different content.' },
      conflicts: ['record-001']
    }, 409))
    const importer = new RailsProgressImporter({ installationId: 'install-001', fetchImpl })

    await expect(importer.importRecords([decisionRecord()])).rejects.toMatchObject({
      status: 409,
      code: 'client_id_conflict',
      conflicts: ['record-001']
    })
  })

  it('propagates a network failure without mutating the records selected for import', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))
    const records = [decisionRecord()]
    const importer = new RailsProgressImporter({ installationId: 'install-001', fetchImpl })

    await expect(importer.importRecords(records)).rejects.toThrow('offline')
    expect(records).toEqual([decisionRecord()])
  })

  it('rejects invalid installation identifiers before network access', () => {
    expect(() => new RailsProgressImporter({ installationId: 'short' })).toThrow('installationId must be 8–128 URL-safe characters')
  })
})
