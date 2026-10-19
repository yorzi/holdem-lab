export const TELEMETRY_SCHEMA_VERSION = 'holdem-telemetry-v1' as const
export const TELEMETRY_EVENT_NAME = 'holdem:telemetry' as const

export type LessonSlug = 'position' | 'pot-odds' | 'decision-quality'
export type PracticeMode = 'live' | 'quiz' | 'street'
export type PracticeStreet = 'preflop' | 'flop' | 'turn' | 'river'
export type SessionScoreBand = 'none' | 'partial' | 'complete'

const LESSON_SLUGS: readonly LessonSlug[] = ['position', 'pot-odds', 'decision-quality']
const PRACTICE_MODES: readonly PracticeMode[] = ['live', 'quiz', 'street']
const PRACTICE_STREETS: readonly PracticeStreet[] = ['preflop', 'flop', 'turn', 'river']
const SESSION_SCORE_BANDS: readonly SessionScoreBand[] = ['none', 'partial', 'complete']

export type TelemetryEvent =
  | {
      readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
      readonly name: 'lesson_view'
      readonly lessonSlug: LessonSlug
    }
  | {
      readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
      readonly name: 'practice_start'
      readonly mode: PracticeMode
    }
  | {
      readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
      readonly name: 'decision_locked'
      readonly mode: PracticeMode
      readonly street: PracticeStreet
    }
  | {
      readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
      readonly name: 'session_complete'
      readonly lessonSlug: LessonSlug
      readonly scoreBand: SessionScoreBand
    }
  | {
      readonly schemaVersion: typeof TELEMETRY_SCHEMA_VERSION
      readonly name: 'review_open'
    }

export function isTelemetryEnabled(): boolean {
  if (typeof document === 'undefined') return false

  return document.querySelector<HTMLMetaElement>('meta[name="holdem-telemetry"]')?.content === 'true'
}

function isLessonSlug(value: unknown): value is LessonSlug {
  return typeof value === 'string' && LESSON_SLUGS.includes(value as LessonSlug)
}

function isPracticeMode(value: unknown): value is PracticeMode {
  return typeof value === 'string' && PRACTICE_MODES.includes(value as PracticeMode)
}

function isPracticeStreet(value: unknown): value is PracticeStreet {
  return typeof value === 'string' && PRACTICE_STREETS.includes(value as PracticeStreet)
}

function isSessionScoreBand(value: unknown): value is SessionScoreBand {
  return typeof value === 'string' && SESSION_SCORE_BANDS.includes(value as SessionScoreBand)
}

function allowlistedEvent(event: TelemetryEvent): TelemetryEvent | null {
  switch (event.name) {
    case 'lesson_view':
      return isLessonSlug(event.lessonSlug)
        ? { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: event.name, lessonSlug: event.lessonSlug }
        : null
    case 'practice_start':
      return isPracticeMode(event.mode)
        ? { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: event.name, mode: event.mode }
        : null
    case 'decision_locked':
      return isPracticeMode(event.mode) && isPracticeStreet(event.street)
        ? { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: event.name, mode: event.mode, street: event.street }
        : null
    case 'session_complete':
      return isLessonSlug(event.lessonSlug) && isSessionScoreBand(event.scoreBand)
        ? {
            schemaVersion: TELEMETRY_SCHEMA_VERSION,
            name: event.name,
            lessonSlug: event.lessonSlug,
            scoreBand: event.scoreBand
          }
        : null
    case 'review_open':
      return { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: event.name }
    default:
      return null
  }
}

/**
 * Dispatches a local inspection event only when the Rails boot contract opts in.
 * There is deliberately no network, storage, identifier, timestamp, or payload
 * enrichment here. The event is reconstructed at runtime so extra properties
 * from an unsafe caller cannot cross this local contract.
 */
export function trackTelemetry(event: TelemetryEvent): void {
  if (typeof window === 'undefined' || !isTelemetryEnabled()) return

  const safeEvent = allowlistedEvent(event)
  if (!safeEvent) return

  window.dispatchEvent(new CustomEvent<TelemetryEvent>(TELEMETRY_EVENT_NAME, { detail: safeEvent }))
}
