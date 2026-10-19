import { Card } from '../cards/cards'
import { Action, ActionEntry, GameState, LegalActions, PlayerId, Seat, Street } from '../betting/holdem'

export type TrainingMode = 'live' | 'quiz' | 'street' | 'review'

/** Persisted values are stable codes; localization belongs at the display edge. */
export type FeedbackLabel = 'benchmark_strategy' | 'approximate_analysis' | 'solver_data'
export type ErrorTag = 'over_calling' | 'over_folding' | 'poor_bet_sizing'

const FEEDBACK_LABELS: Readonly<Record<FeedbackLabel, string>> = {
  benchmark_strategy: 'Benchmark strategy',
  approximate_analysis: 'Approximate analysis',
  solver_data: 'Solver data'
}

const ERROR_TAG_LABELS: Readonly<Record<ErrorTag, string>> = {
  over_calling: 'Over-calling',
  over_folding: 'Over-folding',
  poor_bet_sizing: 'Poor bet sizing'
}

const SEAT_LABELS: Readonly<Record<Seat, string>> = {
  button: 'Button / small blind',
  bigBlind: 'Big blind'
}

export interface StrategyAnalysis {
  readonly method: string
  readonly assumptions: readonly string[]
  readonly evidence: readonly string[]
}

export interface StrategyFeedback {
  readonly label: FeedbackLabel
  readonly recommendation: Action
  readonly recommendationText: string
  readonly rationale: string
  readonly potOdds: number | null
  readonly estimatedEquity: number
  readonly selectedEv: number
  readonly benchmarkEv: number
  readonly evLoss: number | null
  readonly analysis: StrategyAnalysis
  readonly assumptions: readonly string[]
  readonly source: string
}

export interface DecisionRecord {
  readonly version: 2
  readonly id: string
  readonly mode: Exclude<TrainingMode, 'review'>
  readonly street: Street
  readonly heroPosition: Seat
  readonly heroHoleCards: readonly Card[]
  readonly publicCards: readonly Card[]
  readonly effectiveStack: number
  readonly heroStack: number
  readonly villainStack: number
  readonly pot: number
  readonly opponentActions: readonly ActionEntry[]
  readonly actionHistory: readonly ActionEntry[]
  readonly legalActions: LegalActions
  readonly userAction: Action
  readonly userReason: string
  readonly confidence: number
  readonly feedback: StrategyFeedback
  readonly errorTags: readonly ErrorTag[]
  readonly seed: string
  readonly rngAlgorithmVersion: string
  readonly ruleVersion: string
  readonly evaluatorVersion: string
  readonly createdAt: string
  readonly snapshot: GameState
  readonly resultState: GameState
}

export interface DecisionRecordInput {
  readonly id: string
  readonly mode: Exclude<TrainingMode, 'review'>
  readonly state: GameState
  readonly legalActions: LegalActions
  readonly action: Action
  readonly userReason: string
  readonly confidence: number
  readonly feedback: StrategyFeedback
  readonly errorTags: readonly ErrorTag[]
  readonly resultState: GameState
  readonly opponentActions: readonly ActionEntry[]
  readonly createdAt: string
}

export function createDecisionRecord(input: DecisionRecordInput): DecisionRecord {
  const hero = input.state.players.hero
  const villain = input.state.players.villain
  return {
    version: 2,
    id: input.id,
    mode: input.mode,
    street: input.state.street,
    heroPosition: input.state.heroSeat,
    heroHoleCards: [...hero.holeCards],
    publicCards: [...input.state.publicCards],
    effectiveStack: Math.min(hero.stack, villain.stack),
    heroStack: hero.stack,
    villainStack: villain.stack,
    pot: input.state.pot,
    opponentActions: [...input.opponentActions],
    actionHistory: [...input.state.actionHistory],
    legalActions: input.legalActions,
    userAction: input.action,
    userReason: input.userReason,
    confidence: input.confidence,
    feedback: input.feedback,
    errorTags: [...input.errorTags],
    seed: input.state.seed,
    rngAlgorithmVersion: input.state.rngAlgorithmVersion,
    ruleVersion: input.state.ruleVersion,
    evaluatorVersion: input.state.evaluatorVersion,
    createdAt: input.createdAt,
    snapshot: input.state,
    resultState: input.resultState
  }
}

export function feedbackLabelText(label: FeedbackLabel): string {
  return FEEDBACK_LABELS[label]
}

export function errorTagText(tag: ErrorTag): string {
  return ERROR_TAG_LABELS[tag]
}

export function seatLabel(seat: Seat): string {
  return SEAT_LABELS[seat]
}

export function recordOutcomeLabel(record: DecisionRecord): string {
  if (record.errorTags.length === 0) {
    return 'Ready to review'
  }
  return record.errorTags.map(errorTagText).join(', ')
}

export function isUserDecision(state: GameState, playerId: PlayerId = 'hero'): boolean {
  return state.phase === 'action' && state.currentActor === playerId
}
