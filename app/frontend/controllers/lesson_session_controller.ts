import { Controller } from '@hotwired/stimulus'
import { TELEMETRY_SCHEMA_VERSION, trackTelemetry, type LessonSlug } from '../telemetry/events'

export default class extends Controller<HTMLElement> {
  static targets = ['question', 'feedback', 'summary', 'score', 'missed', 'reason', 'confidence', 'reasonSummary', 'confidenceSummary', 'evidence']

  declare readonly questionTargets: HTMLFieldSetElement[]
  declare readonly summaryTarget: HTMLElement
  declare readonly scoreTarget: HTMLElement
  declare readonly missedTarget: HTMLElement
  declare readonly reasonTarget: HTMLTextAreaElement
  declare readonly confidenceTarget: HTMLSelectElement
  declare readonly reasonSummaryTarget: HTMLElement
  declare readonly confidenceSummaryTarget: HTMLElement
  declare readonly evidenceTarget: HTMLElement

  connect(): void {
    const lessonSlug = this.lessonSlug
    if (!lessonSlug || this.element.dataset.telemetryViewed === 'true') return

    this.element.dataset.telemetryViewed = 'true'
    trackTelemetry({ schemaVersion: TELEMETRY_SCHEMA_VERSION, name: 'lesson_view', lessonSlug })
  }

  check(event: Event): void {
    const button = event.currentTarget as HTMLButtonElement
    const question = button.closest<HTMLFieldSetElement>('[data-lesson-session-target~="question"]')
    if (!question || question.dataset.answered === 'true') return

    const selected = question.querySelector<HTMLInputElement>('input[type="radio"]:checked')
    const feedback = question.querySelector<HTMLElement>('[data-lesson-session-target~="feedback"]')
    if (!feedback) return

    if (!selected) {
      feedback.textContent = this.copy.chooseAnswer
      feedback.hidden = false
      feedback.setAttribute('role', 'alert')
      feedback.focus()
      return
    }

    const correct = selected.value === question.dataset.answer
    question.dataset.answered = 'true'
    question.dataset.correct = String(correct)
    question.classList.add(correct ? 'border-moss/40' : 'border-coral/40')
    question.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => { input.disabled = true })
    button.disabled = true
    feedback.setAttribute('role', 'status')
    feedback.textContent = correct ? question.dataset.correctFeedback ?? this.copy.correct : question.dataset.reviewFeedback ?? this.copy.review
    feedback.hidden = false
    feedback.focus()

    this.updateSummary()
  }

  retry(): void {
    delete this.element.dataset.telemetryCompleted

    for (const question of this.questionTargets) {
      delete question.dataset.answered
      delete question.dataset.correct
      question.classList.remove('border-moss/40', 'border-coral/40')
      question.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => {
        input.checked = false
        input.disabled = false
      })
      const button = question.querySelector<HTMLButtonElement>('button[data-action~="lesson-session#check"]')
      if (button) button.disabled = false
      const feedback = question.querySelector<HTMLElement>('[data-lesson-session-target~="feedback"]')
      if (feedback) {
        feedback.hidden = true
        feedback.textContent = ''
      }
    }

    this.summaryTarget.hidden = true
    this.scoreTarget.textContent = ''
    this.missedTarget.textContent = ''
    this.questionTargets[0]?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
  }

  private updateSummary(): void {
    const answered = this.questionTargets.filter((question) => question.dataset.answered === 'true')
    if (answered.length !== this.questionTargets.length) return

    const correct = answered.filter((question) => question.dataset.correct === 'true').length
    const missed = answered
      .filter((question) => question.dataset.correct !== 'true')
      .map((question) => question.dataset.concept)
      .filter((concept): concept is string => Boolean(concept))

    this.scoreTarget.textContent = `${correct} / ${this.questionTargets.length}`
    this.missedTarget.textContent = missed.length === 0
      ? this.copy.noMissed
      : `${this.copy.reviewNext} ${missed.join('; ')}.`
    this.reasonSummaryTarget.textContent = this.reasonTarget.value.trim() || this.copy.noReflection
    this.confidenceSummaryTarget.textContent = `${this.confidenceTarget.value} / 5 ${this.copy.beforeFeedback}`
    this.evidenceTarget.textContent = this.element.dataset.evidenceCoverage ?? this.copy.noEvidence
    this.summaryTarget.hidden = false

    const lessonSlug = this.lessonSlug
    if (lessonSlug && this.element.dataset.telemetryCompleted !== 'true') {
      this.element.dataset.telemetryCompleted = 'true'
      trackTelemetry({
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        name: 'session_complete',
        lessonSlug,
        scoreBand: correct === 0 ? 'none' : correct === this.questionTargets.length ? 'complete' : 'partial'
      })
    }

    window.requestAnimationFrame(() => this.summaryTarget.focus())
  }

  private get lessonSlug(): LessonSlug | null {
    const slug = this.element.dataset.lessonSlug
    return slug === 'position' || slug === 'pot-odds' || slug === 'decision-quality' ? slug : null
  }

  private get copy(): {
    readonly chooseAnswer: string
    readonly correct: string
    readonly review: string
    readonly noMissed: string
    readonly reviewNext: string
    readonly noReflection: string
    readonly beforeFeedback: string
    readonly noEvidence: string
  } {
    const locale = document.querySelector<HTMLMetaElement>('meta[name="holdem-locale"]')?.content
    return locale === 'zh'
      ? {
          chooseAnswer: '检查前请选择一个答案。',
          correct: '正确。',
          review: '请复习这个概念。',
          noMissed: '本次没有漏掉任何概念。进入 Practice 时，继续保持规则边界可见。',
          reviewNext: '下一步复习：',
          noReflection: '没有记录反思。',
          beforeFeedback: '反馈前',
          noEvidence: '没有提供证据覆盖信息。'
        }
      : {
          chooseAnswer: 'Choose one answer before checking.',
          correct: 'Correct.',
          review: 'Review this concept.',
          noMissed: 'No concepts missed in this session. Keep the rule boundary visible when you move into practice.',
          reviewNext: 'Review next:',
          noReflection: 'No reflection recorded.',
          beforeFeedback: 'before feedback',
          noEvidence: 'Evidence coverage was not provided.'
        }
  }
}
