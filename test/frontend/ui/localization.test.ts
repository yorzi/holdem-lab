import { describe, expect, it } from 'vitest'
import type { ActionEntry } from '../../../app/frontend/holdem/domain/betting/holdem'
import type { StrategyFeedback } from '../../../app/frontend/holdem/domain/records/decision-record'
import { actionEntryText, actionStreamEntryText, handCategoryText, localizedFeedback } from '../../../app/frontend/holdem/ui/localization'

function feedbackFor(recommendation: StrategyFeedback['recommendation'], potOdds: number | null): StrategyFeedback {
  return {
    label: 'approximate_analysis',
    recommendation,
    recommendationText: 'placeholder',
    rationale: 'placeholder',
    potOdds,
    estimatedEquity: 0.45,
    selectedEv: 0,
    benchmarkEv: 0,
    evLoss: null,
    analysis: { method: 'test', assumptions: [], evidence: [] },
    assumptions: [],
    source: 'test'
  }
}

describe('display-edge localization', () => {
  it('localizes action timeline labels without changing stable action codes', () => {
    const entry: ActionEntry = {
      sequence: 1,
      actor: 'hero',
      type: 'check',
      street: 'preflop',
      amount: 0,
      potAfter: 100
    }

    expect(entry.type).toBe('check')
    expect(actionEntryText(entry, 'en')).toBe('hero · check')
    expect(actionStreamEntryText(entry, 'en')).toBe('You check')
    expect(actionEntryText(entry, 'zh')).toBe('你 过牌 Check')
  })

  it('keeps technical hand categories readable in both locales', () => {
    expect(handCategoryText('straight-flush', 'en')).toBe('Straight flush')
    expect(handCategoryText('straight-flush', 'zh')).toBe('同花顺 Straight flush')
  })

  it('renders localized recommendation amounts without BB string replacement', () => {
    const localized = localizedFeedback(feedbackFor({ type: 'bet', amount: 300 }, null), 'zh')

    expect(localized.recommendationText).toBe('下注 Bet to 300 chips')
    expect(localized.rationale).toContain('价值下注')
  })

  it('does not describe an oversized call as an ordinary pot-odds decision', () => {
    const localized = localizedFeedback(feedbackFor({ type: 'fold' }, null), 'zh')

    expect(localized.rationale).toContain('超过了可用筹码')
    expect(localized.rationale).not.toContain('跟注临界值')
  })
})
