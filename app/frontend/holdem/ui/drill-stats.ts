import type { DrillStatsMap } from './DrillLibrary'

export const EMPTY_DRILL_STATS: DrillStatsMap = {
  cardNotation: { total: 0, correct: 0, streak: 0, bestStreak: 0 },
  bestFive: { total: 0, correct: 0, streak: 0, bestStreak: 0 }
}
