import { beforeEach, describe, expect, it } from 'vitest'
import {
  isTelemetryEnabled,
  TELEMETRY_EVENT_NAME,
  TELEMETRY_SCHEMA_VERSION,
  trackTelemetry,
  type TelemetryEvent
} from '../../../app/frontend/telemetry/events'

function installTelemetryMeta(content: string): void {
  const meta = document.createElement('meta')
  meta.name = 'holdem-telemetry'
  meta.content = content
  document.head.append(meta)
}

describe('privacy-minimal telemetry contract', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('is disabled when the Rails boot meta tag is absent or false', () => {
    expect(isTelemetryEnabled()).toBe(false)

    const events: TelemetryEvent[] = []
    window.addEventListener(TELEMETRY_EVENT_NAME, (event) => events.push((event as CustomEvent<TelemetryEvent>).detail))
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'review_open' })
    expect(events).toEqual([])

    installTelemetryMeta('false')
    expect(isTelemetryEnabled()).toBe(false)
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'review_open' })
    expect(events).toEqual([])
  })

  it('dispatches only the explicit allowlisted fields when enabled', () => {
    installTelemetryMeta('true')
    const events: TelemetryEvent[] = []
    window.addEventListener(TELEMETRY_EVENT_NAME, (event) => events.push((event as CustomEvent<TelemetryEvent>).detail))

    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'lesson_view', lessonSlug: 'position' })
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'practice_start', mode: 'quiz' })
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'decision_locked', mode: 'street', street: 'turn' })
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'session_complete', lessonSlug: 'pot-odds', scoreBand: 'partial' })
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'review_open' })

    expect(events).toEqual([
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'lesson_view', lessonSlug: 'position' },
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'practice_start', mode: 'quiz' },
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'decision_locked', mode: 'street', street: 'turn' },
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'session_complete', lessonSlug: 'pot-odds', scoreBand: 'partial' },
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'review_open' }
    ])
  })

  it('reconstructs the allowlisted payload instead of forwarding extra properties', () => {
    installTelemetryMeta('true')
    const events: TelemetryEvent[] = []
    window.addEventListener(TELEMETRY_EVENT_NAME, (event) => events.push((event as CustomEvent<TelemetryEvent>).detail))

    trackTelemetry({
      schemaVersion: 'holdem-telemetry-v999',
      name: 'review_open',
      cards: ['Ah', 'Kd'],
      reason: 'private review context'
    } as unknown as TelemetryEvent)

    trackTelemetry({
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      name: 'session_complete',
      lessonSlug: 'pot-odds',
      scoreBand: 'partial',
      snapshot: { cards: ['As', 'Kd'] }
    } as unknown as TelemetryEvent)

    trackTelemetry({
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      name: 'practice_start',
      mode: 'unrecognized-mode'
    } as unknown as TelemetryEvent)

    expect(events).toEqual([
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'review_open' },
      { schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'session_complete', lessonSlug: 'pot-odds', scoreBand: 'partial' }
    ])
  })
})
