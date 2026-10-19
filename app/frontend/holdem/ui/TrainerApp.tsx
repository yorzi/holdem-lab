import { forwardRef, useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode, type Ref } from 'react'
import {
  Action,
  chipsToBb,
  formatChips,
  GameState,
  getHero,
  getLegalActions,
  getVillain,
  LegalActions,
  Street
} from '../domain/betting/holdem'
import { cardLabel, Card } from '../domain/cards/cards'
import { replayDecisionRecord } from '../application/replay'
import { applyUserActionAndOpponent, createTrainingScenario, nextScenarioSeed, TrainingScenario } from '../application/training'
import { getOrCreateInstallationId } from '../persistence/local-installation'
import { hasLegacyProgress, LocalProgressRepository } from '../persistence/local-progress'
import { LocalProgressOutbox, ResilientProgressRepository } from '../persistence/local-outbox'
import { RailsProgressImportError, RailsProgressImporter } from '../persistence/rails-progress'
import { buildStrategyFeedback, deriveErrorTags } from '../strategy/advisory'
import { createDecisionRecord } from '../domain/records/decision-record'
import type { DecisionRecord, ErrorTag, StrategyFeedback } from '../domain/records/decision-record'
import { DrillLibrary } from './DrillLibrary'
import type { DrillStatKey, DrillStatsMap } from './DrillLibrary'
import { EMPTY_DRILL_STATS } from './drill-stats'
import { actionEntryText, actionStreamEntryText, describeActionText, errorTagTextFor, feedbackLabelTextFor, getUiCopy, localizedFeedback, recordOutcomeText, type UiLocale } from './localization'
import { TELEMETRY_SCHEMA_VERSION, trackTelemetry } from '../../telemetry/events'

type TrainerMode = 'live' | 'quiz' | 'street'

type LocalImportStatus =
  | { readonly state: 'idle' }
  | { readonly state: 'importing' }
  | { readonly state: 'success'; readonly accepted: number; readonly claimed: number; readonly duplicates: number; readonly conflicts: number }
  | { readonly state: 'error'; readonly message: string; readonly code: string; readonly conflicts: readonly string[] }

const STREET_OPTIONS: readonly { id: Street }[] = [
  { id: 'preflop' },
  { id: 'flop' },
  { id: 'turn' },
  { id: 'river' }
]

const DRILL_STATS_STORAGE_KEY = 'holdem-lab:drill-stats:v2'
const DRILL_STAT_KEYS: readonly DrillStatKey[] = ['cardNotation', 'bestFive']

function readStoredDrillStats(): DrillStatsMap {
  try {
    const raw = window.localStorage.getItem(DRILL_STATS_STORAGE_KEY)
    if (!raw) return EMPTY_DRILL_STATS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_DRILL_STATS
    const source = parsed as Record<string, unknown>
    const result = { ...EMPTY_DRILL_STATS } as Record<DrillStatKey, DrillStatsMap[DrillStatKey]>
    for (const key of DRILL_STAT_KEYS) {
      const entry = source[key]
      if (typeof entry !== 'object' || entry === null) continue
      const values = entry as Record<string, unknown>
      const total = typeof values.total === 'number' && Number.isFinite(values.total) ? Math.max(0, Math.trunc(values.total)) : 0
      const correct = typeof values.correct === 'number' && Number.isFinite(values.correct) ? Math.max(0, Math.trunc(values.correct)) : 0
      const streak = typeof values.streak === 'number' && Number.isFinite(values.streak) ? Math.max(0, Math.trunc(values.streak)) : 0
      const bestStreak = typeof values.bestStreak === 'number' && Number.isFinite(values.bestStreak) ? Math.max(streak, Math.trunc(values.bestStreak)) : streak
      result[key] = { total, correct: Math.min(correct, total), streak, bestStreak }
    }
    return result
  } catch {
    return EMPTY_DRILL_STATS
  }
}

function writeStoredDrillStats(stats: DrillStatsMap): void {
  window.localStorage.setItem(DRILL_STATS_STORAGE_KEY, JSON.stringify(stats))
}

function streetLabel(street: Street, locale: UiLocale): string {
  return getUiCopy(locale).street[street] ?? street
}

function PlayingCard({ card, hidden = false, locale }: { readonly card?: Card; readonly hidden?: boolean; readonly locale: UiLocale }): ReactElement {
  return (
    <span
      aria-label={hidden ? getUiCopy(locale).aria.hiddenCard : card ? cardLabel(card) : getUiCopy(locale).aria.emptyCard}
      className={`inline-grid h-14 w-10 place-items-center rounded-lg border text-sm font-semibold shadow-sm sm:h-16 sm:w-12 lg:h-12 lg:w-9 ${
        hidden ? 'border-moss/40 bg-moss/20 text-moss' : card ? 'border-ink/10 bg-paper text-ink' : 'border-dashed border-paper/30 text-paper/50'
      }`}
    >
      {hidden ? '✦' : card ? cardLabel(card) : '·'}
    </span>
  )
}

function CardRow({ cards, hidden = false, emptySlots = 0, locale }: { readonly cards: readonly Card[]; readonly hidden?: boolean; readonly emptySlots?: number; readonly locale: UiLocale }): ReactElement {
  const slots = [...cards, ...Array.from({ length: emptySlots }, () => undefined)]
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((card, index) => <PlayingCard key={`${card ? cardLabel(card) : 'empty'}-${index}`} card={card} hidden={hidden} locale={locale} />)}
    </div>
  )
}

const Panel = forwardRef<HTMLElement, { readonly children: ReactNode; readonly className?: string } & HTMLAttributes<HTMLElement>>(({ children, className = '', ...attributes }, ref) => (
  <section {...attributes} className={`rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm sm:p-6 ${className}`} ref={ref}>{children}</section>
))

Panel.displayName = 'Panel'

function ActionButton({ label, onClick, disabled = false, secondary = false }: { readonly label: string; readonly onClick: () => void; readonly disabled?: boolean; readonly secondary?: boolean }): ReactElement {
  return (
    <button
      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${
        secondary ? 'border border-ink/15 bg-paper text-ink hover:border-moss' : 'bg-moss text-paper hover:bg-ink'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function PlayerCard({ state, playerId, label, hidden = false, locale }: { readonly state: GameState; readonly playerId: 'hero' | 'villain'; readonly label: string; readonly hidden?: boolean; readonly locale: UiLocale }): ReactElement {
  const player = state.players[playerId]
  const active = state.currentActor === playerId && state.phase === 'action'
  const copy = getUiCopy(locale)
  return (
    <div className={`rounded-2xl border p-4 lg:p-3 ${active ? 'border-sand bg-sand/10' : 'border-paper/15 bg-ink/20'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper/60">{playerId === 'hero' ? copy.player.you : copy.player.opponent}</p>
          <p className="mt-1 font-display text-lg text-paper">{label}</p>
        </div>
        <span className="rounded-full border border-paper/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-paper/65">{player.seat === 'button' ? 'BTN' : 'BB'}</span>
      </div>
      <div className="mt-4 lg:mt-3"><CardRow cards={player.holeCards} hidden={hidden} locale={locale} /></div>
      <div className="mt-4 flex items-baseline justify-between gap-3 text-xs text-paper/65 lg:mt-3">
        <span className="font-semibold text-moss">{formatChips(player.stack, state.bigBlind)}</span>
        <span>{copy.player.committed} {formatChips(player.totalContribution, state.bigBlind)}</span>
      </div>
      {player.folded && <p className="mt-3 text-xs font-semibold text-coral">{copy.player.folded}</p>}
      {player.allIn && !player.folded && <p className="mt-3 text-xs font-semibold text-sand">{copy.player.allIn}</p>}
    </div>
  )
}

function PracticeTable({ state, locale }: { readonly state: GameState; readonly locale: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  return (
    <Panel className="!border-ink/0 !bg-ink !p-0 text-paper shadow-none" data-testid="practice-table">
      <div className="flex items-start justify-between gap-4 border-b border-paper/10 p-5 sm:p-6 lg:p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.table.localTable}</p>
          <h2 className="mt-2 font-display text-2xl text-paper">{copy.table.makeDecision}</h2>
        </div>
        <span className="rounded-full border border-paper/15 px-3 py-1 text-xs text-paper/65">{state.phase === 'action' ? copy.table.inPlay : copy.table.settled}</span>
      </div>
      <div className="grid gap-5 bg-gradient-to-br from-[#173e37] via-[#205148] to-[#0e2824] p-5 sm:p-8 lg:gap-3 lg:p-4">
        <PlayerCard state={state} playerId="villain" label={copy.player.practiceOpponent} hidden={state.phase !== 'complete'} locale={locale} />
        <div className="rounded-2xl border border-paper/15 bg-ink/15 p-5 text-center lg:p-4">
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper/55">
            <span>{copy.table.communityBoard}</span>
            <span className="rounded-full border border-moss/40 px-2 py-1 text-moss">{streetLabel(state.street, locale)}</span>
          </div>
          <div className="mt-5 flex min-h-16 justify-center lg:mt-3 lg:min-h-14"><CardRow cards={state.publicCards} emptySlots={5 - state.publicCards.length} locale={locale} /></div>
          <p className="mt-5 text-xs uppercase tracking-[0.14em] text-paper/55 lg:mt-3">{copy.table.pot} <strong className="ml-2 text-lg normal-case tracking-normal text-paper">{formatChips(state.pot, state.bigBlind)}</strong></p>
        </div>
        <PlayerCard state={state} playerId="hero" label={copy.player.yourDecision} locale={locale} />
      </div>
      <div className="flex flex-col gap-3 border-t border-paper/10 p-5 text-xs text-paper/60 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:p-4">
        <div>
          <p className="font-semibold uppercase tracking-[0.15em] text-paper/45">{copy.table.actionStream}</p>
          <p className="mt-2">{state.actionHistory.slice(-4).map((entry) => actionStreamEntryText(entry, locale)).join(' · ') || copy.table.waiting}</p>
        </div>
        <code className="text-moss">seed:{state.seed}</code>
      </div>
    </Panel>
  )
}

function DecisionPanel({ state, mode, locale, legal, reason, showReasonPrompt, amountBb, confidence, onReasonChange, onShowReasonPromptChange, onAmountChange, onConfidenceChange, onSubmit, onError }: {
  readonly state: GameState
  readonly mode: TrainerMode
  readonly locale: UiLocale
  readonly legal: LegalActions
  readonly reason: string
  readonly showReasonPrompt: boolean
  readonly amountBb: string
  readonly confidence: number
  readonly onReasonChange: (value: string) => void
  readonly onShowReasonPromptChange: (value: boolean) => void
  readonly onAmountChange: (value: string) => void
  readonly onConfidenceChange: (value: number) => void
  readonly onSubmit: (action: Action) => void
  readonly onError: (message: string) => void
}): ReactElement {
  const canAct = state.phase === 'action' && state.currentActor === 'hero'
  const bounds = legal.bet ?? legal.raise
  const copy = getUiCopy(locale)
  const submitSized = (): void => {
    if (bounds === null) return
    const amount = Math.round(Number(amountBb) * state.bigBlind)
    if (!Number.isInteger(amount) || amount < bounds.min || amount > bounds.max) {
      onError(copy.decision.actionError(chipsToBb(bounds.min, state.bigBlind), chipsToBb(bounds.max, state.bigBlind)))
      return
    }
    onSubmit({ type: legal.bet ? 'bet' : 'raise', amount })
  }

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{mode === 'quiz' ? copy.decision.quiz : copy.decision.yourDecision}</p><h2 className="mt-2 font-display text-2xl">{canAct ? `${mode === 'quiz' ? copy.decision.answerSpot : copy.decision.yourAction} · ${streetLabel(state.street, locale)}` : copy.decision.locked}</h2></div>
        <span className="rounded-full bg-sand/15 px-3 py-1 text-xs font-semibold text-sand">{copy.decision.localOnly}</span>
      </div>
      {canAct ? <>
        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-ink/10 py-4 text-xs text-ink/65"><span>{copy.decision.toCall}<strong className="mt-1 block text-base text-ink">{formatChips(legal.toCall, state.bigBlind)}</strong></span><span>{copy.decision.effectiveStack}<strong className="mt-1 block text-base text-ink">{formatChips(Math.min(getHero(state).stack, getVillain(state).stack), state.bigBlind)}</strong></span></div>
        <label className="mt-5 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-ink/10 bg-sand/10 p-3" htmlFor="trainer-reason-toggle">
          <span><span className="block text-xs font-semibold text-ink/70">{copy.decision.reasonToggle}</span><span className="mt-1 block text-xs leading-5 text-ink/55">{copy.decision.reasonToggleHint}</span></span>
          <input aria-controls={showReasonPrompt ? 'trainer-reason' : undefined} aria-expanded={showReasonPrompt} checked={showReasonPrompt} className="mt-1 h-4 w-4 shrink-0 accent-moss" id="trainer-reason-toggle" onChange={(event) => onShowReasonPromptChange(event.target.checked)} type="checkbox" />
        </label>
        {showReasonPrompt && <div>
          <label className="mt-4 block text-xs font-semibold text-ink/70" htmlFor="trainer-reason">{copy.decision.whyAction}</label>
          <textarea aria-describedby="trainer-action-hint" className="mt-2 min-h-24 w-full rounded-xl border border-ink/15 bg-paper/70 p-3 text-sm text-ink outline-none focus:border-moss" id="trainer-reason" onChange={(event) => onReasonChange(event.target.value)} placeholder={copy.decision.reasonPlaceholder} value={reason} />
        </div>}
        <div className="mt-4 flex items-center justify-between gap-4"><label className="text-xs font-semibold text-ink/70" htmlFor="trainer-confidence">{copy.decision.confidence}</label><select aria-describedby="trainer-action-hint" className="rounded-lg border border-ink/15 bg-paper/70 px-3 py-2 text-sm text-ink outline-none focus:border-moss" id="trainer-confidence" onChange={(event) => onConfidenceChange(Number(event.target.value))} value={confidence}>{copy.decision.confidenceOptions.map((option, index) => <option key={option} value={index + 1}>{option}</option>)}</select></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {legal.fold && <ActionButton label={copy.decision.fold} onClick={() => onSubmit({ type: 'fold' })} secondary />}
          {legal.check && <ActionButton label={copy.decision.check} onClick={() => onSubmit({ type: 'check' })} />}
          {legal.call !== null && <ActionButton label={`${copy.decision.call} ${formatChips(legal.call, state.bigBlind)}`} onClick={() => onSubmit({ type: 'call' })} />}
          {legal.allIn !== null && <ActionButton label={copy.decision.allIn} onClick={() => onSubmit({ type: 'allIn' })} secondary />}
        </div>
        {bounds && <div className="mt-4 flex items-end gap-3"><label className="min-w-0 flex-1 text-xs font-semibold text-ink/70" htmlFor="trainer-sizing">{legal.bet ? copy.decision.betTo : copy.decision.raiseTo} (BB)<input aria-describedby="trainer-action-hint" className="mt-2 w-full rounded-xl border border-ink/15 bg-paper/70 p-3 font-mono text-sm text-ink outline-none focus:border-moss" id="trainer-sizing" inputMode="decimal" onChange={(event) => onAmountChange(event.target.value)} value={amountBb} /></label><ActionButton label={legal.bet ? copy.decision.bet : copy.decision.raise} onClick={submitSized} /> </div>}
        <p className="mt-4 text-xs leading-5 text-ink/55" id="trainer-action-hint">{copy.decision.hint}</p>
      </> : <div className="mt-6 rounded-xl bg-sand/10 p-4 text-sm leading-6 text-ink/70">{copy.decision.complete}</div>}
    </Panel>
  )
}

function FeedbackPanel({ feedback, tags, state, locale, feedbackRef }: { readonly feedback: StrategyFeedback; readonly tags: readonly ErrorTag[]; readonly state: GameState; readonly locale: UiLocale; readonly feedbackRef: Ref<HTMLElement> }): ReactElement {
  const copy = getUiCopy(locale)
  const displayFeedback = localizedFeedback(feedback, locale)
  return (
    <Panel aria-live="polite" className="border-moss/20 bg-moss/10 focus:outline-none" data-testid="strategy-feedback" ref={feedbackRef} role="status" tabIndex={-1}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.feedback.postDecision}</p><h2 className="mt-2 font-display text-2xl">{copy.feedback.transparentApproximation}</h2></div><span className="rounded-full bg-sand/20 px-3 py-1 text-xs font-semibold text-ink">{feedbackLabelTextFor(displayFeedback.label, locale)}</span></div>
      <p className="mt-5 text-sm leading-6 text-ink/75">{copy.feedback.baselineDirection} <strong className="text-ink">{describeActionText(displayFeedback.recommendation, state.bigBlind, locale)}</strong>. {displayFeedback.rationale}</p>
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10">
        <Metric label={copy.feedback.potOdds} value={displayFeedback.potOdds === null ? '—' : `${(displayFeedback.potOdds * 100).toFixed(1)}%`} />
        <Metric label={copy.feedback.estimatedEquity} value={`${(displayFeedback.estimatedEquity * 100).toFixed(1)}%`} />
        <Metric label={copy.feedback.evLoss} value={displayFeedback.evLoss === null ? copy.feedback.notProvided : `${chipsToBb(displayFeedback.evLoss, state.bigBlind).toFixed(2)} BB`} />
        <Metric label={copy.feedback.method} value={displayFeedback.analysis.method.replace('-v1', '').replace(/-/g, ' ')} />
      </div>
      {tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <span className="rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral" key={tag}>{errorTagTextFor(tag, locale)}</span>)}</div>}
      <details className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/60"><summary className="cursor-pointer font-semibold text-ink">{copy.feedback.assumptions}</summary><ul className="mt-3 list-disc space-y-1 pl-5">{displayFeedback.analysis.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}{displayFeedback.analysis.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><p className="mt-3">{copy.feedback.source} {displayFeedback.source}</p></details>
    </Panel>
  )
}

type ReplayOutcome = {
  readonly recordId: string
  readonly status: 'idle' | 'verified' | 'mismatch' | 'error'
  readonly actionCount?: number
  readonly state?: GameState
  readonly message?: string
}

function ReviewReplay({ record, locale }: { readonly record: DecisionRecord; readonly locale: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  const [outcome, setOutcome] = useState<ReplayOutcome>({ recordId: record.id, status: 'idle' })

  useEffect(() => {
    setOutcome({ recordId: record.id, status: 'idle' })
  }, [record.id])

  const replay = (): void => {
    try {
      const result = replayDecisionRecord(record)
      setOutcome({
        recordId: record.id,
        status: result.matchesResult ? 'verified' : 'mismatch',
        actionCount: result.input.actions.length,
        state: result.state,
        message: result.matchesResult ? undefined : copy.replay.mismatch
      })
    } catch (error) {
      setOutcome({
        recordId: record.id,
        status: 'error',
        message: error instanceof Error ? error.message : copy.replay.rejected
      })
    }
  }

  const currentOutcome = outcome.recordId === record.id ? outcome : { recordId: record.id, status: 'idle' as const }

  return (
    <Panel aria-labelledby="review-replay-title" className="border-moss/20 bg-moss/5" data-testid="review-replay">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">{copy.replay.deterministic}</p>
          <h3 className="mt-2 font-display text-xl" id="review-replay-title">{copy.replay.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">{copy.replay.description}</p>
        </div>
        <button className="min-h-11 rounded-xl bg-moss px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2" data-testid="replay-hand" onClick={replay} type="button">{copy.replay.button}</button>
      </div>
      {currentOutcome.status === 'verified' && currentOutcome.state && <div aria-live="polite" className="mt-5 rounded-xl border border-moss/25 bg-moss/10 p-4" data-testid="replay-verified" role="status"><p className="font-semibold text-moss">{copy.replay.verified}</p><p className="mt-2 text-sm leading-6 text-ink/70">{currentOutcome.actionCount} {copy.replay.playerActions} · {streetLabel(currentOutcome.state.street, locale)} · {currentOutcome.state.phase === 'complete' ? copy.replay.handComplete : copy.replay.decisionPending} · {copy.table.pot.toLowerCase()} {formatChips(currentOutcome.state.pot, currentOutcome.state.bigBlind)}</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">{copy.replay.heroHand}</p><div className="mt-2"><CardRow cards={currentOutcome.state.players.hero.holeCards} locale={locale} /></div></div><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">{copy.replay.board}</p><div className="mt-2"><CardRow cards={currentOutcome.state.publicCards} emptySlots={5 - currentOutcome.state.publicCards.length} locale={locale} /></div></div></div></div>}
      {currentOutcome.status === 'mismatch' && <div aria-live="assertive" className="mt-5 rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-coral" data-testid="replay-mismatch" role="alert">{currentOutcome.message}</div>}
      {currentOutcome.status === 'error' && <div aria-live="assertive" className="mt-5 rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-coral" data-testid="replay-error" role="alert">{copy.replay.rejected} {currentOutcome.message}</div>}
    </Panel>
  )
}

function ReviewQueue({ records, selected, onSelect, importStatus, onImport, importEnabled, legacyProgressDetected, locale }: {
  readonly records: readonly DecisionRecord[]
  readonly selected: DecisionRecord | null
  readonly onSelect: (record: DecisionRecord) => void
  readonly importStatus: LocalImportStatus
  readonly onImport: () => Promise<void>
  readonly importEnabled: boolean
  readonly legacyProgressDetected: boolean
  readonly locale: UiLocale
}): ReactElement {
  const copy = getUiCopy(locale)
  return (
    <div className="mt-8 space-y-6" data-testid="review-queue">
      {legacyProgressDetected && <div className="rounded-2xl border border-sand/50 bg-sand/10 p-5 text-sm leading-6 text-ink/70" data-testid="legacy-progress-notice" role="status"><strong className="text-ink">{copy.review.legacy}</strong> {copy.review.legacyDetails}</div>}
      {importEnabled ? <Panel aria-busy={importStatus.state === 'importing'} aria-labelledby="review-import-title" data-testid="review-import">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.review.explicitImport}</p>
            <h2 className="mt-2 font-display text-2xl" id="review-import-title">{copy.review.keepRailsCopy}</h2>
          </div>
          <span className="rounded-full bg-sand/15 px-3 py-1 text-xs font-semibold text-sand">{copy.review.userTriggered}</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink/65">{copy.review.importDescription}</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ActionButton label={importStatus.state === 'importing' ? copy.review.importing : copy.review.importLocal} onClick={() => { void onImport() }} disabled={records.length === 0 || importStatus.state === 'importing'} secondary />
          <p className="text-xs text-ink/55">{records.length === 0 ? copy.review.nothingToImport : copy.review.ready(records.length)}</p>
        </div>
        {importStatus.state === 'importing' && <p aria-live="polite" className="mt-4 rounded-xl border border-sand/30 bg-sand/10 p-4 text-sm text-ink/70" data-testid="import-status" role="status">{copy.review.importing}</p>}
        {importStatus.state === 'success' && <div aria-live="polite" className="mt-4 rounded-xl border border-moss/25 bg-moss/10 p-4 text-sm leading-6 text-ink/75" data-testid="import-status" role="status"><p className="font-semibold text-moss">{copy.review.importComplete}</p><p className="mt-1">{copy.review.importSummary(importStatus.accepted, importStatus.claimed, importStatus.duplicates, importStatus.conflicts)}</p><p className="mt-2 text-xs text-ink/60">{copy.review.originalsRemain}</p></div>}
        {importStatus.state === 'error' && <div aria-live="assertive" className="mt-4 rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-coral" data-testid="import-status" role="alert"><p className="font-semibold">{copy.review.importFailed} {importStatus.message}</p>{importStatus.conflicts.length > 0 && <p className="mt-1">{copy.review.conflict(importStatus.conflicts.length)}</p>}<p className="mt-2 text-xs">{copy.review.retryImport}</p></div>}
      </Panel> : <Panel aria-labelledby="review-import-disabled-title" data-testid="review-import-disabled"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.review.localOnly}</p><h2 className="mt-2 font-display text-2xl" id="review-import-disabled-title">{copy.review.serverDisabled}</h2><p className="mt-4 max-w-3xl text-sm leading-6 text-ink/65">{copy.review.disabledDescription}</p></Panel>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <Panel aria-labelledby="review-queue-title">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.review.localQueue}</p><h2 className="mt-2 font-display text-2xl" id="review-queue-title">{copy.review.title}</h2></div><span className="rounded-full bg-sand/15 px-3 py-1 text-xs font-semibold text-sand">{copy.review.saved(records.length)}</span></div>
        <p className="mt-4 text-sm leading-6 text-ink/65">{importEnabled ? copy.review.recordsDescription : copy.review.recordsDescriptionNoImport}</p>
        {records.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-ink/15 p-5 text-sm leading-6 text-ink/60">{copy.review.empty}</div> : <div className="mt-6 space-y-2">{records.map((record) => <button aria-controls="review-detail" aria-current={selected?.id === record.id ? 'true' : undefined} aria-pressed={selected?.id === record.id} className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === record.id ? 'border-moss bg-moss/10' : 'border-ink/10 bg-white/55 hover:border-moss'}`} data-testid={`review-record-${record.id}`} key={record.id} onClick={() => onSelect(record)} type="button"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">{streetLabel(record.street, locale)} · {copy.review.mode[record.mode]}</span><span className="text-xs text-ink/45">{record.createdAt.slice(0, 16).replace('T', ' ')}</span></div><p className="mt-2 font-semibold">{describeActionText(record.userAction, record.snapshot.bigBlind, locale)}</p><p className="mt-1 text-xs text-ink/60">{recordOutcomeText(record, locale)} · {copy.review.confidenceBeforeFeedback.toLowerCase()} {record.confidence}/5</p></button>)}</div>}
      </Panel>
      <Panel aria-label={selected ? undefined : copy.aria.decisionDetail} aria-labelledby={selected ? 'review-detail-title' : undefined} id="review-detail">
        {selected ? <>
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.review.decisionRecord} · {selected.version}</p><h2 className="mt-2 font-display text-2xl" id="review-detail-title">{streetLabel(selected.street, locale)} · {describeActionText(selected.userAction, selected.snapshot.bigBlind, locale)}</h2></div><code className="text-xs text-moss">{selected.seed}</code></div>
          <div className="mt-6 grid gap-5 rounded-xl bg-ink p-5 text-paper sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper/55">{copy.review.yourHand}</p><div className="mt-3"><CardRow cards={selected.heroHoleCards} locale={locale} /></div></div><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper/55">{copy.replay.board}</p><div className="mt-3"><CardRow cards={selected.publicCards} emptySlots={5 - selected.publicCards.length} locale={locale} /></div></div></div>
          <div className="mt-6 rounded-xl border border-ink/10 bg-sand/10 p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">{copy.review.yourReason}</p><p className="mt-3 text-sm leading-6 text-ink/80">{selected.userReason || copy.review.noReason}</p><p className="mt-3 text-xs text-ink/55">{copy.review.confidenceBeforeFeedback} {selected.confidence}/5</p></div>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-3"><Metric label={copy.feedback.postDecision} value={feedbackLabelTextFor(selected.feedback.label, locale)} /><Metric label={copy.review.outcomeTag} value={recordOutcomeText(selected, locale)} /><Metric label={copy.feedback.evLoss} value={selected.feedback.evLoss === null ? copy.feedback.notProvided : `${chipsToBb(selected.feedback.evLoss, selected.snapshot.bigBlind).toFixed(2)} BB`} /></div>
          <ReviewReplay locale={locale} record={selected} />
          <details className="mt-6 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/60"><summary className="cursor-pointer font-semibold text-ink">{copy.review.assumptionsTimeline}</summary><ul className="mt-3 list-disc space-y-1 pl-5">{localizedFeedback(selected.feedback, locale).analysis.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}{selected.resultState.actionHistory.map((entry) => <li key={entry.sequence}>{actionEntryText(entry, locale)}</li>)}</ul></details>
        </> : <div className="grid min-h-80 place-items-center text-center text-sm leading-6 text-ink/60"><div><p className="text-3xl">↖</p><p className="mt-3">{copy.review.selectSaved}</p></div></div>}
      </Panel>
    </div>
    </div>
  )
}

function Metric({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return <div className="bg-paper/70 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/50">{label}</p><p className="mt-2 break-words text-sm font-semibold text-ink">{value}</p></div>
}

export default function TrainerApp({ importEnabled = false, locale = 'en' }: { readonly importEnabled?: boolean; readonly locale?: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  const repository = useMemo(() => new ResilientProgressRepository(new LocalProgressRepository(), new LocalProgressOutbox()), [])
  const [workspace, setWorkspace] = useState<'practice' | 'review' | 'library'>('practice')
  const [mode, setMode] = useState<TrainerMode>('live')
  const [focusStreet, setFocusStreet] = useState<Street>('flop')
  const [seedCounter, setSeedCounter] = useState(1)
  const [scenario, setScenario] = useState<TrainingScenario>(() => createTrainingScenario({ mode: 'live', seed: nextScenarioSeed(1) }))
  const [state, setState] = useState<GameState>(scenario.state)
  const [reason, setReason] = useState('')
  const [showReasonPrompt, setShowReasonPrompt] = useState(false)
  const [confidence, setConfidence] = useState(3)
  const [amountBb, setAmountBb] = useState('')
  const [feedback, setFeedback] = useState<StrategyFeedback | null>(null)
  const [feedbackTags, setFeedbackTags] = useState<readonly ErrorTag[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [errorRevision, setErrorRevision] = useState(0)
  const [records, setRecords] = useState<DecisionRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<DecisionRecord | null>(null)
  const [importStatus, setImportStatus] = useState<LocalImportStatus>({ state: 'idle' })
  const [drillStats, setDrillStats] = useState<DrillStatsMap>(() => readStoredDrillStats())
  const [legacyProgressDetected] = useState(() => hasLegacyProgress())
  const feedbackRef = useRef<HTMLElement | null>(null)
  const errorRef = useRef<HTMLDivElement | null>(null)
  const importingRef = useRef(false)

  useEffect(() => {
    let active = true
    void repository.listReviews().then((savedRecords) => {
      if (!active) return
      setRecords(savedRecords)
      setSelectedRecord(savedRecords[0] ?? null)
    })
    return () => { active = false }
  }, [repository])

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus({ preventScroll: true })
  }, [feedback])

  useEffect(() => {
    if (!errorMessage) return
    const frame = window.requestAnimationFrame(() => errorRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [errorMessage, errorRevision])

  const legal = useMemo(() => getLegalActions(state, 'hero'), [state])
  const suggestedAmount = legal.bet ? String(chipsToBb(legal.bet.min, state.bigBlind)) : legal.raise ? String(chipsToBb(legal.raise.min, state.bigBlind)) : ''
  const effectiveAmountBb = amountBb || suggestedAmount

  const reportError = (message: string): void => {
    setErrorMessage(message)
    setErrorRevision((revision) => revision + 1)
  }

  const startScenario = (nextMode: TrainerMode, nextStreet = focusStreet): void => {
    const nextCounter = seedCounter + 1
    const nextScenario = createTrainingScenario({ mode: nextMode, seed: nextScenarioSeed(nextCounter), focusStreet: nextMode === 'street' ? nextStreet : undefined })
    setSeedCounter(nextCounter)
    setScenario(nextScenario)
    setState(nextScenario.state)
    setReason('')
    setShowReasonPrompt(false)
    setConfidence(3)
    setAmountBb('')
    setFeedback(null)
    setFeedbackTags([])
    setErrorMessage('')
  }

  const scoreDrill = (key: DrillStatKey, correct: boolean): void => {
    setDrillStats((current) => {
      const previous = current[key]
      const nextStreak = correct ? previous.streak + 1 : 0
      const nextStats: DrillStatsMap = {
        ...current,
        [key]: {
          total: previous.total + 1,
          correct: previous.correct + (correct ? 1 : 0),
          streak: nextStreak,
          bestStreak: Math.max(previous.bestStreak, nextStreak)
        }
      }
      writeStoredDrillStats(nextStats)
      return nextStats
    })
  }

  const submitAction = async (action: Action): Promise<void> => {
    setErrorMessage('')
    const snapshot = state
    const legalAtDecision = getLegalActions(snapshot, 'hero')
    const nextFeedback = buildStrategyFeedback(snapshot, action)
    const tags = deriveErrorTags(snapshot, action, nextFeedback)
    try {
      const turn = applyUserActionAndOpponent(snapshot, action)
      const record = createDecisionRecord({
        id: `${scenario.id}-decision-${snapshot.actionHistory.length + 1}`,
        mode: scenario.mode,
        state: snapshot,
        legalActions: legalAtDecision,
        action,
        userReason: reason.trim(),
        confidence,
        feedback: nextFeedback,
        errorTags: tags,
        resultState: turn.state,
        opponentActions: turn.opponentActions,
        createdAt: new Date().toISOString()
      })
      await repository.saveDecision(record)
      trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'decision_locked', mode: scenario.mode, street: snapshot.street })
      setRecords((current) => [record, ...current.filter((existing) => existing.id !== record.id)])
      setSelectedRecord(record)
      setImportStatus({ state: 'idle' })
      setState(turn.state)
      setFeedback(localizedFeedback(nextFeedback, locale))
      setFeedbackTags(tags)
      setReason('')
    } catch (error) {
      reportError(error instanceof Error ? error.message : copy.decision.rejected)
    }
  }

  const importLocalProgress = async (): Promise<void> => {
    if (!importEnabled || records.length === 0 || importingRef.current) return

    importingRef.current = true
    setImportStatus({ state: 'importing' })
    try {
      const pendingRecords = await repository.queueForImport(records)
      if (pendingRecords.length === 0) {
        setImportStatus({ state: 'success', accepted: 0, claimed: 0, duplicates: records.length, conflicts: 0 })
        return
      }

      const importer = new RailsProgressImporter({ installationId: getOrCreateInstallationId() })
      const result = await importer.importRecords(pendingRecords)
      repository.markImported(result)
      setImportStatus({
        state: 'success',
        accepted: result.accepted.length,
        claimed: result.claimed?.length ?? 0,
        duplicates: result.duplicates.length,
        conflicts: result.conflicts.length
      })
    } catch (error) {
      setImportStatus({
        state: 'error',
        code: error instanceof RailsProgressImportError ? error.code : 'import_failed',
        message: error instanceof Error ? error.message : locale === 'zh' ? 'Rails import 无法完成。' : 'The Rails import could not be completed.',
        conflicts: error instanceof RailsProgressImportError ? error.conflicts : []
      })
    } finally {
      importingRef.current = false
    }
  }

  const openReview = (): void => {
    if (workspace !== 'review') {
      trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'review_open' })
    }
    setWorkspace('review')
  }

  const hero = getHero(state)
  const villain = getVillain(state)
  const compactWorkspaces = workspace === 'practice'
  const workspaceButtonClass = (active: boolean): string => `h-full rounded-xl border p-4 text-left transition ${active ? 'border-moss bg-moss text-paper' : 'border-ink/10 bg-white/60 hover:border-moss'}`
  const workspaceDescriptionClass = (active: boolean): string => `mt-1 block text-xs ${active ? 'text-paper/70' : 'text-ink/60'}`
  const trainerAppClass = compactWorkspaces ? 'mx-auto max-w-7xl px-5 py-3 text-ink sm:px-8 sm:py-4' : 'mx-auto max-w-7xl px-5 py-10 text-ink sm:px-8 sm:py-14'

  return (
    <div className={trainerAppClass} data-testid="trainer-app">
      {compactWorkspaces ? <div className="flex flex-col justify-between gap-1 border-b border-ink/10 pb-2 sm:flex-row sm:items-baseline sm:gap-3 lg:items-center">
        <div className="min-w-0 sm:flex sm:items-baseline sm:gap-3"><p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-moss">{copy.main.eyebrow}</p><h1 className="mt-1 font-display text-2xl leading-tight tracking-tight sm:mt-0">{copy.main.titleFirst} <span className="text-moss">{copy.main.titleSecond}</span></h1></div>
        <p className="hidden max-w-xs text-xs leading-5 text-ink/65 lg:block">{copy.main.boundary}</p>
      </div> : <div className="flex flex-col justify-between gap-6 border-b border-ink/10 pb-8 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">{copy.main.eyebrow}</p><h1 className="mt-4 max-w-3xl font-display text-4xl leading-[0.98] tracking-tight sm:text-6xl">{copy.main.titleFirst}<br /><span className="text-moss">{copy.main.titleSecond}</span></h1></div>
        <p className="max-w-xs text-sm leading-6 text-ink/65">{copy.main.boundary}</p>
      </div>}

      <nav aria-label={copy.aria.trainerWorkspaces} className={compactWorkspaces ? 'mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5' : 'mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-5'}>
        <button aria-current={workspace === 'practice' && mode === 'live' ? 'page' : undefined} aria-pressed={workspace === 'practice' && mode === 'live'} className={workspaceButtonClass(workspace === 'practice' && mode === 'live')} onClick={() => { setWorkspace('practice'); setMode('live'); startScenario('live') }} type="button"><span className="block text-sm font-semibold">{copy.main.workspaces.live.title}</span><span className={workspaceDescriptionClass(workspace === 'practice' && mode === 'live')}>{copy.main.workspaces.live.description}</span></button>
        <button aria-current={workspace === 'practice' && mode === 'quiz' ? 'page' : undefined} aria-pressed={workspace === 'practice' && mode === 'quiz'} className={workspaceButtonClass(workspace === 'practice' && mode === 'quiz')} onClick={() => { setWorkspace('practice'); setMode('quiz'); startScenario('quiz') }} type="button"><span className="block text-sm font-semibold">{copy.main.workspaces.quiz.title}</span><span className={workspaceDescriptionClass(workspace === 'practice' && mode === 'quiz')}>{copy.main.workspaces.quiz.description}</span></button>
        <button aria-current={workspace === 'practice' && mode === 'street' ? 'page' : undefined} aria-pressed={workspace === 'practice' && mode === 'street'} className={workspaceButtonClass(workspace === 'practice' && mode === 'street')} onClick={() => { setWorkspace('practice'); setMode('street'); startScenario('street', focusStreet) }} type="button"><span className="block text-sm font-semibold">{copy.main.workspaces.street.title}</span><span className={workspaceDescriptionClass(workspace === 'practice' && mode === 'street')}>{copy.main.workspaces.street.description}</span></button>
        <button aria-current={workspace === 'review' ? 'page' : undefined} aria-pressed={workspace === 'review'} className={workspaceButtonClass(workspace === 'review')} onClick={openReview} type="button"><span className="block text-sm font-semibold">{copy.main.workspaces.review.title}</span><span className={workspaceDescriptionClass(workspace === 'review')}>{records.length === 0 ? copy.main.workspaces.review.description : locale === 'zh' ? `${records.length} 条本地 decision 可复盘。` : `${records.length} local decision${records.length === 1 ? '' : 's'} to inspect.`}</span></button>
        <button aria-current={workspace === 'library' ? 'page' : undefined} aria-pressed={workspace === 'library'} className={workspaceButtonClass(workspace === 'library')} onClick={() => setWorkspace('library')} type="button"><span className="block text-sm font-semibold">{copy.main.workspaces.library.title}</span><span className={workspaceDescriptionClass(workspace === 'library')}>{copy.main.workspaces.library.description}</span></button>
      </nav>
      {workspace === 'review' ? <ReviewQueue importEnabled={importEnabled} importStatus={importStatus} legacyProgressDetected={legacyProgressDetected} locale={locale} onImport={importLocalProgress} onSelect={setSelectedRecord} records={records} selected={selectedRecord} /> : workspace === 'library' ? <DrillLibrary locale={locale} stats={drillStats} onScore={scoreDrill} /> : <>
      {mode === 'street' && <div aria-label={copy.aria.focusStreet} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-sand/10 p-3" role="group"><span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">{copy.main.focusStreet}</span>{STREET_OPTIONS.map((option) => <button aria-pressed={focusStreet === option.id} className={`rounded-lg px-3 py-2 text-xs font-semibold ${focusStreet === option.id ? 'bg-ink text-paper' : 'bg-paper text-ink/70 hover:bg-white'}`} key={option.id} onClick={() => { setFocusStreet(option.id); startScenario('street', option.id) }} type="button">{copy.street[option.id]}</button>)}</div>}

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <div className="space-y-5"><PracticeTable locale={locale} state={state} /><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label={copy.main.yourStack} value={formatChips(hero.stack, state.bigBlind)} /><Metric label={copy.main.opponent} value={formatChips(villain.stack, state.bigBlind)} /><Metric label={copy.main.effective} value={formatChips(Math.min(hero.stack, villain.stack), state.bigBlind)} /><Metric label={copy.main.street} value={streetLabel(state.street, locale)} /></div></div>
        <div className="space-y-5 lg:sticky lg:top-20 lg:max-h-[calc(100svh-6rem)] lg:overflow-y-auto lg:pr-1" data-testid="practice-right-rail"><DecisionPanel locale={locale} state={state} mode={mode} legal={legal} reason={reason} showReasonPrompt={showReasonPrompt} confidence={confidence} amountBb={effectiveAmountBb} onReasonChange={setReason} onShowReasonPromptChange={setShowReasonPrompt} onConfidenceChange={setConfidence} onAmountChange={setAmountBb} onSubmit={submitAction} onError={reportError} />{errorMessage && <div aria-live="assertive" className="rounded-xl border border-coral/30 bg-coral/10 p-4 text-sm leading-6 text-coral" id="trainer-action-error" ref={errorRef} role="alert" tabIndex={-1}>{errorMessage}</div>}{feedback && <FeedbackPanel feedback={feedback} feedbackRef={feedbackRef} locale={locale} tags={feedbackTags} state={state} />}{state.phase === 'complete' && <Panel><p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">{copy.main.handResult}</p><h2 className="mt-2 font-display text-2xl">{state.showdown?.winnerIds.includes('hero') ? copy.main.heroWins : state.showdown?.winnerIds.includes('villain') ? copy.main.villainWins : copy.main.split}</h2><p className="mt-3 text-sm leading-6 text-ink/65">{copy.main.resultDescription}</p><ActionButton label={copy.main.nextHand} onClick={() => startScenario(mode)} /></Panel>}</div>
      </div>
      <div className="mt-8 rounded-2xl border border-sand/40 bg-sand/10 p-5 text-sm leading-6 text-ink/70"><strong className="text-ink">{copy.main.evidenceBoundary}</strong> {copy.main.evidenceDescription}</div>
      </>}
    </div>
  )
}
