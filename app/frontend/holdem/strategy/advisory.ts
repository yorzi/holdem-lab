import { cardKey, createStandardDeck } from '../domain/cards/cards'
import {
  Action,
  actionLabel,
  GameState,
  getLegalActions,
  LegalActions,
  PlayerId
} from '../domain/betting/holdem'
import { shuffle } from '../domain/rng/seeded-rng'
import { compareHandRanks, evaluateBestHand } from '../domain/showdown/hand-evaluator'
import { ErrorTag, StrategyFeedback } from '../domain/records/decision-record'

export interface EquityEstimate {
  readonly equity: number
  readonly wins: number
  readonly ties: number
  readonly losses: number
  readonly samples: number
}

function actionCost(legal: LegalActions, action: Action): number {
  if (action.type === 'fold' || action.type === 'check') {
    return 0
  }
  if (action.type === 'call') {
    return legal.call ?? 0
  }
  if (action.type === 'bet' || action.type === 'raise') {
    return Math.max(0, (action.amount ?? legal.currentContribution) - legal.currentContribution)
  }
  return Math.max(0, (legal.allIn ?? legal.currentContribution) - legal.currentContribution)
}

export function estimateHeroEquity(state: GameState, samples = 120): EquityEstimate {
  const hero = state.players.hero
  const knownKeys = new Set([...hero.holeCards, ...state.publicCards].map(cardKey))
  const available = createStandardDeck().filter((card) => !knownKeys.has(cardKey(card)))
  const missingBoardCards = 5 - state.publicCards.length
  let wins = 0
  let ties = 0
  let losses = 0

  for (let index = 0; index < samples; index += 1) {
    const sampled = shuffle(available, `${state.seed}:equity:${index}`)
    const opponentCards = sampled.slice(0, 2)
    const boardCards = [...state.publicCards, ...sampled.slice(2, 2 + missingBoardCards)]
    const heroRank = evaluateBestHand([...hero.holeCards, ...boardCards])
    const opponentRank = evaluateBestHand([...opponentCards, ...boardCards])
    const comparison = compareHandRanks(heroRank, opponentRank)
    if (comparison > 0) wins += 1
    else if (comparison === 0) ties += 1
    else losses += 1
  }

  return {
    equity: (wins + ties / 2) / samples,
    wins,
    ties,
    losses,
    samples
  }
}

function candidateActions(legal: LegalActions): Action[] {
  const actions: Action[] = [{ type: 'fold' }]
  if (legal.check) actions.push({ type: 'check' })
  if (legal.call !== null) actions.push({ type: 'call' })
  if (legal.bet !== null) actions.push({ type: 'bet', amount: legal.bet.min })
  if (legal.raise !== null) actions.push({ type: 'raise', amount: legal.raise.min })
  if (legal.allIn !== null) actions.push({ type: 'allIn' })
  return actions
}

function actionEv(state: GameState, legal: LegalActions, action: Action, equity: number): number {
  if (action.type === 'fold') return 0
  const cost = actionCost(legal, action)
  return equity * (state.pot + cost) - cost
}

function recommendationFor(state: GameState, legal: LegalActions, equity: number): Action {
  const potOdds = legal.call === null || state.pot + legal.call === 0 ? null : legal.call / (state.pot + legal.call)
  if (legal.toCall > 0) {
    if (potOdds !== null && equity >= potOdds + 0.05 && legal.call !== null) {
      return { type: 'call' }
    }
    return { type: 'fold' }
  }
  if (equity >= 0.6 && legal.bet !== null) {
    return { type: 'bet', amount: legal.bet.min }
  }
  if (legal.check) return { type: 'check' }
  if (legal.raise !== null && equity >= 0.6) return { type: 'raise', amount: legal.raise.min }
  return { type: 'fold' }
}

function recommendationText(action: Action): string {
  if (action.type === 'bet' || action.type === 'raise') {
    return `${actionLabel(action.type)} to ${action.amount ?? 0} chips`
  }
  return actionLabel(action.type)
}

function rationaleFor(state: GameState, legal: LegalActions, equity: number): string {
  if (legal.toCall > 0) {
    const potOdds = legal.call === null ? null : legal.call / (state.pot + legal.call)
    if (potOdds !== null && equity >= potOdds + 0.05) {
      return `Sampled equity is about ${(equity * 100).toFixed(1)}%, above the current ${(potOdds * 100).toFixed(1)}% pot-odds threshold. This is a practice comparison between price and estimated equity.`
    }
    return `Sampled equity is about ${(equity * 100).toFixed(1)}% and is not clearly above the call threshold. This simplified baseline therefore prefers folding.`
  }
  return equity >= 0.6
    ? `With no call pending, sampled equity is about ${(equity * 100).toFixed(1)}%. The simplified baseline allows a small value bet.`
    : `With no call pending, sampled equity is about ${(equity * 100).toFixed(1)}%. The simplified baseline keeps the checking option.`
}

export function buildStrategyFeedback(state: GameState, selectedAction: Action): StrategyFeedback {
  const legal = getLegalActions(state, 'hero')
  const estimate = estimateHeroEquity(state)
  const recommendation = recommendationFor(state, legal, estimate.equity)
  const candidateEvs = candidateActions(legal).map((action) => actionEv(state, legal, action, estimate.equity))
  const benchmarkEv = Math.max(...candidateEvs)
  const selectedEv = actionEv(state, legal, selectedAction, estimate.equity)
  const potOdds = legal.call === null || state.pot + legal.call === 0 ? null : legal.call / (state.pot + legal.call)
  const assumptions = [
    `Samples ${estimate.samples} random opponent hands to estimate how often you win.`,
    'Compares only the chips at stake right now. It ignores later streets, the range your opponent actually holds, and the value of position.',
    'This is an estimate meant for practice, not solver output or a claim about optimal play.'
  ]
  const analysis = {
    method: 'deterministic-random-sampling-v1',
    assumptions,
    evidence: [
      `samples=${estimate.samples}`,
      `wins=${estimate.wins}; ties=${estimate.ties}; losses=${estimate.losses}`,
      'recommendation is a local heuristic, not solver output'
    ]
  }

  return {
    label: 'approximate_analysis',
    recommendation,
    recommendationText: recommendationText(recommendation),
    rationale: rationaleFor(state, legal, estimate.equity),
    potOdds,
    estimatedEquity: estimate.equity,
    selectedEv,
    benchmarkEv,
    evLoss: null,
    analysis,
    assumptions,
    source: 'Estimated on your device from this hand.'
  }
}

export function deriveErrorTags(state: GameState, action: Action, feedback: StrategyFeedback): ErrorTag[] {
  const tags: ErrorTag[] = []
  if (feedback.recommendation.type === 'fold' && (action.type === 'call' || action.type === 'allIn')) {
    tags.push('over_calling')
  }
  if (feedback.recommendation.type === 'check' && action.type === 'fold') {
    tags.push('over_folding')
  }
  if ((action.type === 'bet' || action.type === 'raise') && action.amount !== undefined) {
    const paid = actionCost(getLegalActions(state, 'hero'), action)
    if (paid > state.pot * 1.5 || paid < Math.max(1, state.pot * 0.15)) {
      tags.push('poor_bet_sizing')
    }
  }
  return tags
}

export function describeAction(action: Action, bigBlind: number): string {
  if (action.type === 'bet' || action.type === 'raise') {
    return `${actionLabel(action.type)} to ${(action.amount ?? 0) / bigBlind} BB`
  }
  return actionLabel(action.type)
}

export function isActionAvailable(legal: LegalActions, playerId: PlayerId, action: Action): boolean {
  if (playerId !== 'hero') return false
  if (action.type === 'fold') return legal.fold
  if (action.type === 'check') return legal.check
  if (action.type === 'call') return legal.call !== null
  if (action.type === 'allIn') return legal.allIn !== null
  const bounds = action.type === 'bet' ? legal.bet : legal.raise
  return bounds !== null && action.amount !== undefined && action.amount >= bounds.min && action.amount <= bounds.max
}
