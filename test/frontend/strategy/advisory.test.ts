import { describe, expect, it } from 'vitest'
import { createInitialHand, getLegalActions } from '../../../app/frontend/holdem/domain/betting/holdem'
import type { Action } from '../../../app/frontend/holdem/domain/betting/holdem'
import { buildStrategyFeedback, estimateHeroEquity } from '../../../app/frontend/holdem/strategy/advisory'

describe('local strategy advisory', () => {
  it('estimates equity deterministically without changing the hand', () => {
    const state = createInitialHand({ seed: 'equity-test' })
    const before = JSON.stringify(state)
    const first = estimateHeroEquity(state, 20)
    const second = estimateHeroEquity(state, 20)

    expect(first).toEqual(second)
    expect(first.samples).toBe(20)
    expect(first.equity).toBeGreaterThanOrEqual(0)
    expect(first.equity).toBeLessThanOrEqual(1)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('labels feedback as approximate analysis and exposes its assumptions', () => {
    const state = createInitialHand({ seed: 'feedback-test' })
    const legal = getLegalActions(state, 'hero')
    const feedback = buildStrategyFeedback(state, { type: 'call' })

    expect(feedback.label).toBe('approximate_analysis')
    expect(feedback.evLoss).toBeNull()
    expect(feedback.analysis.method).toBe('deterministic-random-sampling-v1')
    expect(feedback.analysis.evidence.length).toBeGreaterThan(0)
    expect(feedback.assumptions.length).toBeGreaterThan(0)
    expect(feedback.assumptions.join(' ')).toContain('not solver output')
    expect(feedback.potOdds).toBeCloseTo((legal.call ?? 0) / (state.pot + (legal.call ?? 0)))
  })

  // 防回归:在当前 100BB / 1000 筹码配置下,recommendationFor 不会返回 allIn。
  // 如果有人误把超注 all-in 分支加回来,这个测试会立刻失败。
  it('never recommends all-in under the current 100BB starting stack', () => {
    const seeds = ['rec-1', 'rec-2', 'rec-3', 'rec-4', 'rec-5', 'rec-6', 'rec-7', 'rec-8']
    for (const seed of seeds) {
      const state = createInitialHand({ seed })
      const feedback = buildStrategyFeedback(state, { type: 'call' })
      expect(feedback.recommendation.type).not.toBe('allIn')
      expect(['fold', 'check', 'call', 'bet', 'raise']).toContain(feedback.recommendation.type)
    }
  })

  // 防回归:recommendationText 与 recommendation.type 对齐——bet/raise 带 chips,
  // 其余 action 不带;rationale 与 recommendation 对齐,不出现跨文案误导
  // (例如 fold 推荐不应出现 "value bet" 文案)。
  it('aligns recommendationText and rationale with the recommended action', () => {
    const seeds = ['align-1', 'align-2', 'align-3', 'align-4', 'align-5']
    for (const seed of seeds) {
      const state = createInitialHand({ seed })
      const feedback = buildStrategyFeedback(state, { type: 'call' })
      const recommendation = feedback.recommendation
      const text = feedback.recommendationText
      const rationale = feedback.rationale

      if (recommendation.type === 'bet' || recommendation.type === 'raise') {
        expect(text).toContain('chips')
        expect(text).toContain(String(recommendation.amount ?? 0))
        expect(rationale).toContain('value bet')
      } else {
        expect(text).not.toContain('chips')
      }

      if (recommendation.type === 'fold') {
        expect(rationale).toContain('folding')
        expect(rationale).not.toContain('value bet')
      }
      if (recommendation.type === 'call') {
        expect(rationale).toContain('pot-odds')
      }
      if (recommendation.type === 'check') {
        expect(rationale).toContain('checking option')
      }
    }
  })

  // 防回归:selectedEv 与 benchmarkEv 都基于 actionCost 计算,且 benchmarkEv >= selectedEv。
  // 之前的 bug 曾在 actionCost 中误用 allIn 分支,导致 benchmarkEv 计算异常。
  it('exposes selectedEv and benchmarkEv with benchmark never below selected', () => {
    const state = createInitialHand({ seed: 'ev-test' })
    const selected: Action = { type: 'call' }
    const feedback = buildStrategyFeedback(state, selected)

    expect(Number.isFinite(feedback.selectedEv)).toBe(true)
    expect(Number.isFinite(feedback.benchmarkEv)).toBe(true)
    expect(feedback.benchmarkEv).toBeGreaterThanOrEqual(feedback.selectedEv)
  })
})
