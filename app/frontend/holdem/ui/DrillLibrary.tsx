import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { cardLabel, type Card } from '../domain/cards/cards'
import {
  createBestFiveQuestion,
  createStartingHandQuestion,
  type PreflopHandType
} from '../domain/drills/card-recognition'
import { type HandCategory } from '../domain/showdown/hand-evaluator'
import { getUiCopy, handCategoryText, type UiLocale } from './localization'

export type DrillStatKey = 'cardNotation' | 'bestFive'

export interface DrillStats {
  readonly total: number
  readonly correct: number
  readonly streak: number
  readonly bestStreak: number
}

export type DrillStatsMap = Readonly<Record<DrillStatKey, DrillStats>>

export interface DrillLibraryProps {
  readonly stats: DrillStatsMap
  readonly onScore: (key: DrillStatKey, correct: boolean) => void
  readonly locale: UiLocale
}

type LibraryTab = DrillStatKey

const TABS: readonly { readonly id: LibraryTab }[] = [
  { id: 'cardNotation' },
  { id: 'bestFive' }
]

const HAND_CATEGORIES: readonly HandCategory[] = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush'
]

function Cards({ cards, locale }: { readonly cards: readonly Card[]; readonly locale: UiLocale }): ReactElement {
  return <div className="flex flex-wrap gap-2">{cards.map((card, index) => <span aria-label={cardLabel(card)} className="inline-grid h-14 w-10 place-items-center rounded-lg border border-ink/10 bg-paper text-sm font-semibold shadow-sm sm:h-16 sm:w-12" key={`${cardLabel(card)}-${index}`}>{cardLabel(card)}</span>)}</div>
}

function Stats({ stats, locale }: { readonly stats: DrillStats; readonly locale: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  const accuracy = stats.total === 0 ? '—' : `${Math.round((stats.correct / stats.total) * 100)}%`
  return <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 text-center"><div className="bg-paper/80 p-3"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">{copy.drill.answered}</span><strong className="mt-1 block">{stats.total}</strong></div><div className="bg-paper/80 p-3"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">{copy.drill.accuracy}</span><strong className="mt-1 block">{accuracy}</strong></div><div className="bg-paper/80 p-3"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">{copy.drill.bestStreak}</span><strong className="mt-1 block">{stats.bestStreak}</strong></div></div>
}

function ChoiceGrid<T extends string>({ choices, selected, answer, label, onChoose }: {
  readonly choices: readonly T[]
  readonly selected: T | null
  readonly answer: T
  readonly label: (choice: T) => string
  readonly onChoose: (choice: T) => void
}): ReactElement {
  return <div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => {
    const answered = selected !== null
    const correct = answered && choice === answer
    const incorrect = answered && choice === selected && choice !== answer
    return <button aria-pressed={selected === choice} className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${correct ? 'border-moss bg-moss/10 text-moss' : incorrect ? 'border-coral bg-coral/10 text-coral' : 'border-ink/10 bg-white/60 hover:border-moss'} disabled:cursor-default`} disabled={answered} key={choice} onClick={() => onChoose(choice)} type="button">{label(choice)}</button>
  })}</div>
}

function Feedback({ correct, answer, explanation, onNext, locale }: { readonly correct: boolean; readonly answer: string; readonly explanation: string; readonly onNext: () => void; readonly locale: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  const feedbackRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { feedbackRef.current?.focus() }, [])
  return <div aria-live="polite" className={`mt-5 rounded-xl border p-5 focus:outline-none ${correct ? 'border-moss/30 bg-moss/10' : 'border-coral/30 bg-coral/10'}`} data-testid="drill-feedback" ref={feedbackRef} role="status" tabIndex={-1}><div className="flex flex-wrap items-start justify-between gap-3"><strong className={correct ? 'text-moss' : 'text-coral'}>{correct ? copy.drill.correct : copy.drill.reviewThis}</strong><span className="text-xs text-ink/60">{copy.drill.answer} {answer}</span></div><p className="mt-3 text-sm leading-6 text-ink/75">{explanation}</p><button className="mt-4 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-paper hover:bg-moss" onClick={onNext} type="button">{copy.drill.nextQuestion}</button></div>
}

function handTypeLabel(type: PreflopHandType, locale: UiLocale): string {
  return {
    en: { pair: 'Pocket pair', suited: 'Suited', offsuit: 'Offsuit' },
    zh: { pair: 'Pocket pair', suited: 'Suited', offsuit: 'Offsuit' }
  }[locale][type]
}

function NotationDrill({ stats, onScore, locale }: { readonly stats: DrillStats; readonly onScore: (correct: boolean) => void; readonly locale: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  const [index, setIndex] = useState(1)
  const [answer, setAnswer] = useState<string | null>(null)
  const question = useMemo(() => createStartingHandQuestion(`notation-${index}`), [index])
  const submit = (choice: string): void => {
    if (answer !== null) return
    setAnswer(choice)
    onScore(choice === question.answer)
  }

  return <section aria-labelledby="notation-title" className="rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.drill.verifiedRecognition}</p><h2 className="mt-2 font-display text-2xl sm:text-3xl" id="notation-title">{copy.drill.notationTitle}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{copy.drill.notationDescription}</p></div><Stats locale={locale} stats={stats} /></div><div className="mt-6 rounded-xl border border-ink/10 bg-white/55 p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">{copy.drill.holeCards}</p><div className="mt-3"><Cards cards={question.cards} locale={locale} /></div><p className="mt-4 text-xs text-ink/55">{copy.drill.classification} {handTypeLabel(question.handType, locale)}</p></div><p className="mt-6 text-sm font-semibold">{copy.drill.notationQuestion}</p><div className="mt-3"><ChoiceGrid answer={question.answer} choices={question.choices} label={(choice) => choice} onChoose={submit} selected={answer} /></div>{answer !== null && <Feedback answer={question.answer} correct={answer === question.answer} explanation={copy.drill.notationExplanation} locale={locale} onNext={() => { setIndex((value) => value + 1); setAnswer(null) }} />}</section>
}

function BestFiveDrill({ stats, onScore, locale }: { readonly stats: DrillStats; readonly onScore: (correct: boolean) => void; readonly locale: UiLocale }): ReactElement {
  const copy = getUiCopy(locale)
  const [index, setIndex] = useState(1)
  const [answer, setAnswer] = useState<HandCategory | null>(null)
  const question = useMemo(() => createBestFiveQuestion(`best-five-${index}`), [index])
  const submit = (choice: HandCategory): void => {
    if (answer !== null) return
    setAnswer(choice)
    onScore(choice === question.answer)
  }

  return <section aria-labelledby="best-five-title" className="rounded-2xl border border-ink/10 bg-white/60 p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-moss">{copy.drill.evaluatorIdentity}</p><h2 className="mt-2 font-display text-2xl sm:text-3xl" id="best-five-title">{copy.drill.bestFiveTitle}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">{copy.drill.bestFiveDescription}</p></div><Stats locale={locale} stats={stats} /></div><div className="mt-6 grid gap-5 rounded-xl border border-ink/10 bg-white/55 p-5 sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">{copy.drill.holeCards}</p><div className="mt-3"><Cards cards={question.holeCards} locale={locale} /></div></div><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">{copy.drill.board}</p><div className="mt-3"><Cards cards={question.board} locale={locale} /></div></div></div><p className="mt-6 text-sm font-semibold">{copy.drill.categoryQuestion}</p><div className="mt-3"><ChoiceGrid answer={question.answer} choices={HAND_CATEGORIES} label={(choice) => handCategoryText(choice, locale)} onChoose={submit} selected={answer} /></div>{answer !== null && <Feedback answer={handCategoryText(question.answer, locale)} correct={answer === question.answer} explanation={copy.drill.evaluatorExplanation(question.bestCards.map(cardLabel).join(' '))} locale={locale} onNext={() => { setIndex((value) => value + 1); setAnswer(null) }} />}</section>
}

export function DrillLibrary({ stats, onScore, locale }: DrillLibraryProps): ReactElement {
  const copy = getUiCopy(locale)
  const [tab, setTab] = useState<LibraryTab>('cardNotation')
  const focusTab = (index: number): void => {
    const next = TABS[index]
    setTab(next.id)
    document.getElementById(`drill-tab-${next.id}`)?.focus()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index - 1 + TABS.length) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null
    if (nextIndex === null) return
    event.preventDefault()
    focusTab(nextIndex)
  }

  return <div className="mt-8" data-testid="drill-library"><aside className="rounded-2xl border border-moss/30 bg-moss/10 p-5"><h2 className="font-display text-2xl">{copy.drill.libraryTitle}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-ink/70">{copy.drill.libraryDescription}</p></aside><div aria-label={copy.drill.tablist} className="mt-5 flex flex-wrap gap-2 border-b border-ink/10 pb-3" role="tablist">{TABS.map((item, index) => <button aria-controls={`drill-panel-${item.id}`} aria-selected={tab === item.id} className={`rounded-lg px-4 py-3 text-xs font-semibold ${tab === item.id ? 'bg-ink text-paper' : 'bg-white/60 text-ink/65 hover:text-moss'}`} id={`drill-tab-${item.id}`} key={item.id} onClick={() => setTab(item.id)} onKeyDown={(event) => handleKeyDown(event, index)} role="tab" tabIndex={tab === item.id ? 0 : -1} type="button">{copy.drill.tabs[item.id]}</button>)}</div><div aria-labelledby="drill-tab-cardNotation" hidden={tab !== 'cardNotation'} id="drill-panel-cardNotation" role="tabpanel"><NotationDrill locale={locale} onScore={(correct) => onScore('cardNotation', correct)} stats={stats.cardNotation} /></div><div aria-labelledby="drill-tab-bestFive" hidden={tab !== 'bestFive'} id="drill-panel-bestFive" role="tabpanel"><BestFiveDrill locale={locale} onScore={(correct) => onScore('bestFive', correct)} stats={stats.bestFive} /></div></div>
}
