import type { Street } from '../domain/betting/holdem'
import type { DecisionRecord, ErrorTag, FeedbackLabel, TrainingMode } from '../domain/records/decision-record'
import { RNG_ALGORITHM_VERSION } from '../domain/rng/seeded-rng'
import { HAND_EVALUATOR_VERSION, HOLDEM_RULES_VERSION } from '../domain/versions'

export const PROGRESS_FORMAT_VERSION = 'holdem-progress-v2'
export const PROGRESS_STORAGE_KEY = 'holdem-lab:progress:v2'
export const LEGACY_PROGRESS_STORAGE_KEY = 'holdem-lab:progress:v1'

export interface ReviewFilter {
  readonly mode?: Exclude<TrainingMode, 'review'>
  readonly street?: Street
  readonly errorTag?: ErrorTag
  readonly limit?: number
}

export interface ProgressRepository {
  saveDecision(record: DecisionRecord): Promise<void>
  listReviews(filter?: ReviewFilter): Promise<DecisionRecord[]>
  clear(): Promise<void>
}

interface StoredProgress {
  readonly version: typeof PROGRESS_FORMAT_VERSION
  readonly records: readonly DecisionRecord[]
}

const MODES: readonly Exclude<TrainingMode, 'review'>[] = ['live', 'quiz', 'street']
const STREETS: readonly Street[] = ['preflop', 'flop', 'turn', 'river']
const SEATS = ['button', 'bigBlind'] as const
const ERROR_TAGS: readonly ErrorTag[] = ['over_calling', 'over_folding', 'poor_bet_sizing']
const FEEDBACK_LABELS: readonly FeedbackLabel[] = ['benchmark_strategy', 'approximate_analysis', 'solver_data']

// 本地存储容量有限,且每条记录含两份完整 GameState(含 52 张 deck)。上限防止无界增长;
// 达到上限时拒绝新增记录,不静默淘汰既有复盘原件。
const MAX_STORED_RECORDS = 300

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasCurrentStateVersions(value: unknown): boolean {
  return isRecord(value) &&
    value.ruleVersion === HOLDEM_RULES_VERSION &&
    value.evaluatorVersion === HAND_EVALUATOR_VERSION &&
    value.rngAlgorithmVersion === RNG_ALGORITHM_VERSION
}

// 校验 UI 实际读取的 GameState 结构(数组/对象),避免半损坏记录通过版本校验后
// 在渲染时因 `resultState.actionHistory.map` 等访问而抛错。
function hasValidGameStateShape(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.bigBlind !== 'number' || !(value.bigBlind > 0) || !Number.isFinite(value.bigBlind)) return false
  if (typeof value.pot !== 'number' || !Number.isFinite(value.pot)) return false
  if (typeof value.seed !== 'string' || value.seed.length === 0) return false
  if (!STREETS.includes(value.street as Street)) return false
  if (!Array.isArray(value.publicCards) || !Array.isArray(value.actionHistory)) return false
  if (!isRecord(value.players) || !isRecord(value.players.hero) || !isRecord(value.players.villain)) return false
  if (!Array.isArray(value.players.hero.holeCards) || !Array.isArray(value.players.villain.holeCards)) return false
  return true
}

function isDecisionRecord(value: unknown): value is DecisionRecord {
  if (!isRecord(value)) return false
  if (value.version !== 2 || typeof value.id !== 'string' || value.id.length === 0 || typeof value.createdAt !== 'string') return false
  if (!MODES.includes(value.mode as Exclude<TrainingMode, 'review'>)) return false
  if (!STREETS.includes(value.street as Street) || !SEATS.includes(value.heroPosition as typeof SEATS[number])) return false
  if (value.ruleVersion !== HOLDEM_RULES_VERSION || value.evaluatorVersion !== HAND_EVALUATOR_VERSION || value.rngAlgorithmVersion !== RNG_ALGORITHM_VERSION) return false
  if (!Array.isArray(value.errorTags) || !value.errorTags.every((tag) => ERROR_TAGS.includes(tag as ErrorTag))) return false
  if (!isRecord(value.feedback) || !FEEDBACK_LABELS.includes(value.feedback.label as FeedbackLabel)) return false
  if (!hasCurrentStateVersions(value.snapshot) || !hasCurrentStateVersions(value.resultState)) return false
  if (!hasValidGameStateShape(value.snapshot) || !hasValidGameStateShape(value.resultState)) return false
  // 顶层去范式字段:复盘 UI 直接读取这些值。
  if (!Array.isArray(value.heroHoleCards) || !Array.isArray(value.publicCards)) return false
  if (typeof value.userReason !== 'string' || typeof value.seed !== 'string' || value.seed.length === 0) return false
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return false
  if (!isRecord(value.userAction) || typeof value.userAction.type !== 'string') return false
  return true
}

function readRecords(storage: Storage, key: string): DecisionRecord[] {
  const raw = storage.getItem(key)
  if (raw === null) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== PROGRESS_FORMAT_VERSION || !Array.isArray(parsed.records)) return []
    return parsed.records.filter(isDecisionRecord)
  } catch {
    return []
  }
}

function defaultStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Local progress requires a browser storage adapter')
  }
  return window.localStorage
}

function matches(record: DecisionRecord, filter: ReviewFilter): boolean {
  if (filter.mode !== undefined && record.mode !== filter.mode) return false
  if (filter.street !== undefined && record.street !== filter.street) return false
  if (filter.errorTag !== undefined && !record.errorTags.includes(filter.errorTag)) return false
  return true
}

/**
 * Anonymous-first persistence. V1 remains untouched in its old key: its deal
 * order cannot be reproduced by rules v2, so it is never silently migrated.
 */
export class LocalProgressRepository implements ProgressRepository {
  private readonly storage: Storage
  private readonly key: string

  constructor(storage: Storage = defaultStorage(), key = PROGRESS_STORAGE_KEY) {
    this.storage = storage
    this.key = key
  }

  async saveDecision(record: DecisionRecord): Promise<void> {
    if (!isDecisionRecord(record)) {
      throw new TypeError('DecisionRecord is not compatible with the current progress contract')
    }
    const records = readRecords(this.storage, this.key)
    const isReplacement = records.some((existing) => existing.id === record.id)
    if (!isReplacement && records.length >= MAX_STORED_RECORDS) {
      throw new Error(`Local review history is full at ${MAX_STORED_RECORDS} records; existing records were not changed.`)
    }
    const nextRecords = [record, ...records.filter((existing) => existing.id !== record.id)]
    const payload: StoredProgress = { version: PROGRESS_FORMAT_VERSION, records: nextRecords }
    this.storage.setItem(this.key, JSON.stringify(payload))
  }

  async listReviews(filter: ReviewFilter = {}): Promise<DecisionRecord[]> {
    const records = readRecords(this.storage, this.key)
      .filter((record) => matches(record, filter))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    const limit = filter.limit === undefined ? records.length : Math.max(0, Math.trunc(filter.limit))
    return records.slice(0, limit)
  }

  async clear(): Promise<void> {
    this.storage.removeItem(this.key)
  }
}

export function hasLegacyProgress(storage: Storage = defaultStorage()): boolean {
  return storage.getItem(LEGACY_PROGRESS_STORAGE_KEY) !== null
}

export function isPersistedDecisionRecord(value: unknown): value is DecisionRecord {
  return isDecisionRecord(value)
}
