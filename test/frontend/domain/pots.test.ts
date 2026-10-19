import { describe, expect, it } from 'vitest'
import { buildPots, sumContributions } from '../../../app/frontend/holdem/domain/pots/pots'

describe('pot construction', () => {
  it('builds main and side pots from unequal contributions', () => {
    const participants = [
      { playerId: 'hero', totalContribution: 100, folded: false },
      { playerId: 'villain', totalContribution: 300, folded: false },
      { playerId: 'third', totalContribution: 300, folded: false }
    ]

    expect(buildPots(participants)).toEqual([
      { amount: 300, cap: 100, eligiblePlayerIds: ['hero', 'villain', 'third'] },
      { amount: 400, cap: 300, eligiblePlayerIds: ['villain', 'third'] }
    ])
  })

  it('removes folded players from eligibility but keeps their chips in the pot', () => {
    const participants = [
      { playerId: 'hero', totalContribution: 200, folded: true },
      { playerId: 'villain', totalContribution: 200, folded: false }
    ]

    expect(buildPots(participants)).toEqual([{ amount: 400, cap: 200, eligiblePlayerIds: ['villain'] }])
    expect(sumContributions(participants)).toBe(400)
  })
})
