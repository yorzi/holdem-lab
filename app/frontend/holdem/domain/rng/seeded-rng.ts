export const RNG_ALGORITHM_VERSION = 'mulberry32-fisher-yates-v1'

export type Seed = number | string

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function normalizeSeed(seed: Seed): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.trunc(seed) >>> 0
  }
  return hashSeed(String(seed))
}

/** A small deterministic PRNG. It is for replayable training data, not security. */
export class SeededRng {
  private state: number

  public constructor(seed: Seed) {
    this.state = normalizeSeed(seed)
  }

  public nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return (value ^ (value >>> 14)) >>> 0
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer')
    }
    return this.nextUint32() % maxExclusive
  }
}

export function shuffle<T>(items: readonly T[], seed: Seed): T[] {
  const result = [...items]
  const rng = new SeededRng(seed)
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(index + 1)
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}
