export const INSTALLATION_ID_STORAGE_KEY = 'holdem-lab:installation-id:v1'

const INSTALLATION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/

export interface InstallationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function createInstallationId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('A secure browser random source is required before local progress can be imported.')
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function defaultStorage(): InstallationStorage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Local progress import requires browser storage.')
  }
  return window.localStorage
}

/**
 * Return a stable anonymous installation scope without treating it as an
 * account identity. This is intentionally called only by the explicit import
 * flow, so browsing and local-only practice do not create an upload identifier.
 */
export function getOrCreateInstallationId(
  storage: InstallationStorage = defaultStorage(),
  generateId: () => string = createInstallationId,
): string {
  const existing = storage.getItem(INSTALLATION_ID_STORAGE_KEY)
  if (existing !== null && INSTALLATION_ID_PATTERN.test(existing)) return existing

  const generated = generateId()
  if (!INSTALLATION_ID_PATTERN.test(generated)) {
    throw new Error('The generated installation identifier does not match the import contract.')
  }

  storage.setItem(INSTALLATION_ID_STORAGE_KEY, generated)
  return generated
}
