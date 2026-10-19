export interface PotParticipant {
  readonly playerId: string
  readonly totalContribution: number
  readonly folded: boolean
}

export interface Pot {
  readonly amount: number
  readonly cap: number
  readonly eligiblePlayerIds: readonly string[]
}

export function buildPots(participants: readonly PotParticipant[]): Pot[] {
  const levels = [...new Set(participants.map((participant) => participant.totalContribution).filter((amount) => amount > 0))]
    .sort((left, right) => left - right)
  const pots: Pot[] = []
  let previousLevel = 0

  for (const level of levels) {
    const contributors = participants.filter((participant) => participant.totalContribution >= level)
    const amount = (level - previousLevel) * contributors.length
    const eligiblePlayerIds = contributors
      .filter((participant) => !participant.folded)
      .map((participant) => participant.playerId)
    if (amount > 0) {
      pots.push({ amount, cap: level, eligiblePlayerIds })
    }
    previousLevel = level
  }

  return pots
}

export function sumContributions(participants: readonly Pick<PotParticipant, 'totalContribution'>[]): number {
  return participants.reduce((total, participant) => total + participant.totalContribution, 0)
}
