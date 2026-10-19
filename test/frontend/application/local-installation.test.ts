import { describe, expect, it } from 'vitest'
import { getOrCreateInstallationId, INSTALLATION_ID_STORAGE_KEY, type InstallationStorage } from '../../../app/frontend/holdem/persistence/local-installation'

class MemoryStorage implements InstallationStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('local installation scope', () => {
  it('reuses a valid stored identifier without generating a new one', () => {
    const storage = new MemoryStorage()
    storage.setItem(INSTALLATION_ID_STORAGE_KEY, 'stored-install-001')
    let generated = false

    const result = getOrCreateInstallationId(storage, () => {
      generated = true
      return 'new-install-001'
    })

    expect(result).toBe('stored-install-001')
    expect(generated).toBe(false)
  })

  it('replaces malformed storage with a stable generated identifier', () => {
    const storage = new MemoryStorage()
    storage.setItem(INSTALLATION_ID_STORAGE_KEY, 'bad id')

    const result = getOrCreateInstallationId(storage, () => 'generated-install-001')

    expect(result).toBe('generated-install-001')
    expect(storage.getItem(INSTALLATION_ID_STORAGE_KEY)).toBe('generated-install-001')
  })

  it('rejects a generated identifier outside the Rails contract', () => {
    const storage = new MemoryStorage()

    expect(() => getOrCreateInstallationId(storage, () => 'invalid id')).toThrow('generated installation identifier')
    expect(storage.getItem(INSTALLATION_ID_STORAGE_KEY)).toBeNull()
  })
})
