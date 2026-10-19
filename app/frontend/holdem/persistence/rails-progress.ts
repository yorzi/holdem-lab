import { PROGRESS_FORMAT_VERSION, isPersistedDecisionRecord } from './local-progress'
import type { DecisionRecord } from '../domain/records/decision-record'

export const IMPORT_FORMAT_VERSION = 'holdem-import-v2'
export const DEFAULT_IMPORT_ENDPOINT = '/api/v1/imports/local_progress'

export interface RailsProgressImportResponse {
  readonly version: typeof IMPORT_FORMAT_VERSION
  readonly accepted: readonly string[]
  readonly duplicates: readonly string[]
  readonly claimed?: readonly string[]
  readonly conflicts: readonly string[]
}

export interface RailsProgressImporterOptions {
  readonly installationId: string
  readonly endpoint?: string
  readonly csrfToken?: string
  readonly fetchImpl?: typeof fetch
}

export class RailsProgressImportError extends Error {
  readonly status: number
  readonly code: string
  readonly conflicts: readonly string[]

  constructor(message: string, status: number, code = 'import_failed', conflicts: readonly string[] = []) {
    super(message)
    this.name = 'RailsProgressImportError'
    this.status = status
    this.code = code
    this.conflicts = conflicts
  }
}

interface ErrorPayload {
  readonly error?: {
    readonly code?: unknown
    readonly message?: unknown
  }
  readonly conflicts?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function defaultCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || undefined
}

function responseConflicts(payload: unknown): readonly string[] {
  if (!isRecord(payload) || !Array.isArray(payload.conflicts)) return []
  return payload.conflicts.filter((value): value is string => typeof value === 'string')
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function parseImportResponse(payload: unknown): RailsProgressImportResponse {
  if (!isRecord(payload) || payload.version !== IMPORT_FORMAT_VERSION) {
    throw new RailsProgressImportError('The Rails import response has an unsupported version.', 200, 'invalid_response')
  }

  const accepted = payload.accepted
  const duplicates = payload.duplicates
  const claimed = payload.claimed
  const conflicts = payload.conflicts
  if (!isStringArray(accepted) || !isStringArray(duplicates) || (claimed !== undefined && !isStringArray(claimed)) || !isStringArray(conflicts)) {
    throw new RailsProgressImportError('The Rails import response is malformed.', 200, 'invalid_response')
  }

  return {
    version: IMPORT_FORMAT_VERSION,
    accepted,
    duplicates,
    ...(claimed === undefined ? {} : { claimed }),
    conflicts
  }
}

function parseErrorPayload(payload: unknown): { readonly code: string; readonly message: string; readonly conflicts: readonly string[] } {
  const source = isRecord(payload) ? payload as ErrorPayload : {}
  const error = isRecord(source.error) ? source.error : {}
  return {
    code: typeof error.code === 'string' ? error.code : 'import_failed',
    message: typeof error.message === 'string' ? error.message : 'The Rails import failed.',
    conflicts: responseConflicts(source)
  }
}

/**
 * Explicit same-origin bridge for importing anonymous local records into Rails.
 * Construct and call this adapter from an intentional account/import flow; it is
 * never wired into LocalProgressRepository or TrainerApp automatically.
 */
export class RailsProgressImporter {
  private readonly installationId: string
  private readonly endpoint: string
  private readonly csrfToken: string | undefined
  private readonly fetchImpl: typeof fetch

  constructor(options: RailsProgressImporterOptions) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(options.installationId)) {
      throw new Error('installationId must be 8–128 URL-safe characters')
    }

    this.installationId = options.installationId
    this.endpoint = options.endpoint ?? DEFAULT_IMPORT_ENDPOINT
    this.csrfToken = options.csrfToken ?? defaultCsrfToken()
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  async importRecords(records: readonly DecisionRecord[]): Promise<RailsProgressImportResponse> {
    const invalidRecord = records.find((record) => !isPersistedDecisionRecord(record))
    if (invalidRecord !== undefined) {
      throw new Error('Every local progress record must match the persisted DecisionRecord schema')
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    if (this.csrfToken !== undefined) headers['X-CSRF-Token'] = this.csrfToken

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        version: PROGRESS_FORMAT_VERSION,
        installation_id: this.installationId,
        records
      })
    })

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new RailsProgressImportError('The Rails import response was not valid JSON.', response.status, 'invalid_response')
    }

    if (!response.ok) {
      const error = parseErrorPayload(payload)
      throw new RailsProgressImportError(error.message, response.status, error.code, error.conflicts)
    }

    return parseImportResponse(payload)
  }
}
