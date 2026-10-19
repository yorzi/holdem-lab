import type { DecisionRecord } from '../domain/records/decision-record'
import { isPersistedDecisionRecord, type ProgressRepository, type ReviewFilter } from './local-progress'

export const PROGRESS_OUTBOX_FORMAT_VERSION = 'holdem-progress-outbox-v1'
export const PROGRESS_OUTBOX_STORAGE_KEY = 'holdem-lab:progress-outbox:v1'
export const MAX_OUTBOX_RECORDS = 300

export type ProgressOutboxState = 'pending' | 'synced'

export interface ProgressOutboxEntry {
  readonly id: string
  readonly state: ProgressOutboxState
  readonly fingerprint: string
  readonly record?: DecisionRecord
}

interface StoredOutbox {
  readonly version: typeof PROGRESS_OUTBOX_FORMAT_VERSION
  readonly entries: readonly ProgressOutboxEntry[]
}

export interface ImportAcknowledgement {
  readonly accepted: readonly string[]
  readonly duplicates: readonly string[]
  readonly claimed?: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOutboxEntry(value: unknown): value is ProgressOutboxEntry {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.fingerprint !== 'string') return false
  if (value.state === 'synced') return true
  if (value.state !== 'pending') return false
  if (value.record === undefined) return true
  return isPersistedDecisionRecord(value.record) && value.record.id === value.id
}

function readEntries(storage: Storage, key: string): ProgressOutboxEntry[] {
  const raw = storage.getItem(key)
  if (raw === null) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== PROGRESS_OUTBOX_FORMAT_VERSION || !Array.isArray(parsed.entries)) return []
    return parsed.entries.filter(isOutboxEntry)
  } catch {
    return []
  }
}

function writeEntries(storage: Storage, key: string, entries: readonly ProgressOutboxEntry[]): void {
  const payload: StoredOutbox = { version: PROGRESS_OUTBOX_FORMAT_VERSION, entries }
  storage.setItem(key, JSON.stringify(payload))
}

function defaultStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Local progress outbox requires a browser storage adapter')
  }
  return window.localStorage
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value

  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = canonicalize(value[key])
    return result
  }, {})
}

async function fingerprint(record: DecisionRecord): Promise<string> {
  const serialized = JSON.stringify(canonicalize(record))
  const subtle = globalThis.crypto?.subtle
  if (subtle !== undefined && typeof TextEncoder !== 'undefined') {
    try {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(serialized))
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    } catch {
      // Fall through to the canonical payload marker when Web Crypto is
      // unavailable in a restricted browser context.
    }
  }

  // Modern browsers and the supported test runtime provide SHA-256. The
  // canonical payload is a conservative fallback for restricted runtimes;
  // it remains a comparison marker, not a security credential.
  return serialized
}

function assertRecord(record: DecisionRecord): void {
  if (!isPersistedDecisionRecord(record)) {
    throw new TypeError('DecisionRecord is not compatible with the current progress contract')
  }
}

/**
 * Durable local queue for explicit progress imports. A pending entry keeps a
 * complete record while it is being made durable or staged for a request; once
 * the local repository has its own copy, the outbox keeps only the pending
 * marker and fingerprint. Synced entries use the same compact representation.
 */
export class LocalProgressOutbox {
  private readonly storage: Storage
  private readonly key: string

  constructor(storage: Storage = defaultStorage(), key = PROGRESS_OUTBOX_STORAGE_KEY) {
    this.storage = storage
    this.key = key
  }

  async enqueue(record: DecisionRecord): Promise<void> {
    assertRecord(record)
    const previous = readEntries(this.storage, this.key)
    const nextEntry: ProgressOutboxEntry = {
      id: record.id,
      state: 'pending',
      fingerprint: await fingerprint(record),
      record
    }
    const existingIndex = previous.findIndex((entry) => entry.id === record.id)
    if (existingIndex === -1 && previous.length >= MAX_OUTBOX_RECORDS) {
      throw new Error(`Local progress outbox is full at ${MAX_OUTBOX_RECORDS} records; existing entries were not changed.`)
    }

    const next = existingIndex === -1
      ? [nextEntry, ...previous]
      : previous.map((entry, index) => index === existingIndex ? nextEntry : entry)
    writeEntries(this.storage, this.key, next)
  }

  /**
   * Seed the queue at the user's explicit import boundary. Existing synced
   * entries remain synced when the local record is unchanged; changed records
   * become pending again and are never silently overwritten on the server.
   */
  async ensureRecords(records: readonly DecisionRecord[]): Promise<void> {
    records.forEach(assertRecord)
    const fingerprints = await Promise.all(records.map((record) => fingerprint(record)))
    const previous = readEntries(this.storage, this.key)
    const next = [...previous]
    const additions = records.filter((record) => !previous.some((entry) => entry.id === record.id))
    if (previous.length + additions.length > MAX_OUTBOX_RECORDS) {
      throw new Error(`Local progress outbox is full at ${MAX_OUTBOX_RECORDS} records; existing entries were not changed.`)
    }

    records.forEach((record, index) => {
      const existingIndex = next.findIndex((entry) => entry.id === record.id)
      const existing = existingIndex === -1 ? undefined : next[existingIndex]
      if (existing?.fingerprint === fingerprints[index]) {
        if (existing.state === 'pending' && existing.record === undefined) {
          next[existingIndex] = { ...existing, record }
        }
        return
      }

      const nextEntry: ProgressOutboxEntry = {
        id: record.id,
        state: 'pending',
        fingerprint: fingerprints[index],
        record
      }
      if (existingIndex === -1) next.unshift(nextEntry)
      else next[existingIndex] = nextEntry
    })

    if (next.length !== previous.length || next.some((entry, index) => entry !== previous[index])) {
      writeEntries(this.storage, this.key, next)
    }
  }

  pendingRecords(): DecisionRecord[] {
    return readEntries(this.storage, this.key)
      .filter((entry): entry is ProgressOutboxEntry & { readonly record: DecisionRecord } => entry.state === 'pending' && entry.record !== undefined)
      .map((entry) => entry.record)
  }

  pendingCount(): number {
    return readEntries(this.storage, this.key).filter((entry) => entry.state === 'pending').length
  }

  listEntries(): readonly ProgressOutboxEntry[] {
    return readEntries(this.storage, this.key)
  }

  markSynced(ids: readonly string[]): void {
    const idSet = new Set(ids)
    const previous = readEntries(this.storage, this.key)
    const next = previous.map((entry) => entry.state === 'pending' && idSet.has(entry.id)
      ? { id: entry.id, state: 'synced' as const, fingerprint: entry.fingerprint }
      : entry)
    if (next.some((entry, index) => entry !== previous[index])) writeEntries(this.storage, this.key, next)
  }

  compactEntry(id: string): void {
    const previous = readEntries(this.storage, this.key)
    const next = previous.map((entry) => entry.id === id && entry.state === 'pending' && entry.record !== undefined
      ? { id: entry.id, state: 'pending' as const, fingerprint: entry.fingerprint }
      : entry)
    if (next.some((entry, index) => entry !== previous[index])) writeEntries(this.storage, this.key, next)
  }

  entryFor(id: string): ProgressOutboxEntry | undefined {
    return readEntries(this.storage, this.key).find((entry) => entry.id === id)
  }

  restoreEntry(id: string, entry: ProgressOutboxEntry | undefined): void {
    const previous = readEntries(this.storage, this.key)
    const withoutId = previous.filter((candidate) => candidate.id !== id)
    const next = entry === undefined ? withoutId : [entry, ...withoutId]
    writeEntries(this.storage, this.key, next)
  }

  clear(): void {
    this.storage.removeItem(this.key)
  }
}

/**
 * Keeps local review writes and the explicit import outbox together. It never
 * starts a network request: callers must queue records at an intentional user
 * action and then acknowledge the returned server ids.
 */
export class ResilientProgressRepository implements ProgressRepository {
  private readonly local: ProgressRepository
  private readonly outbox: LocalProgressOutbox

  constructor(local: ProgressRepository, outbox: LocalProgressOutbox) {
    this.local = local
    this.outbox = outbox
  }

  async saveDecision(record: DecisionRecord): Promise<void> {
    const previous = this.outbox.entryFor(record.id)
    await this.outbox.enqueue(record)
    try {
      await this.local.saveDecision(record)
      try {
        this.outbox.compactEntry(record.id)
      } catch {
        // The local record is already durable; keep the larger outbox entry if
        // compaction itself cannot be persisted and retry at explicit import.
      }
    } catch (error) {
      try {
        this.outbox.restoreEntry(record.id, previous)
      } catch {
        // Keep the new outbox entry if rollback cannot be persisted; it still
        // contains the record needed for a later explicit recovery attempt.
      }
      throw error
    }
  }

  listReviews(filter?: ReviewFilter): Promise<DecisionRecord[]> {
    return this.local.listReviews(filter)
  }

  async clear(): Promise<void> {
    await this.local.clear()
    this.outbox.clear()
  }

  async queueForImport(records: readonly DecisionRecord[]): Promise<DecisionRecord[]> {
    await this.outbox.ensureRecords(records)
    return this.outbox.pendingRecords()
  }

  markImported(acknowledgement: ImportAcknowledgement): void {
    this.outbox.markSynced([ ...acknowledgement.accepted, ...acknowledgement.duplicates, ...(acknowledgement.claimed ?? []) ])
  }

  pendingImportCount(): number {
    return this.outbox.pendingCount()
  }

  outboxEntries(): readonly ProgressOutboxEntry[] {
    return this.outbox.listEntries()
  }
}
