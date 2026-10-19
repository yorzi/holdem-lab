import { beforeEach, describe, expect, it } from 'vitest'
import partialSource from '../../../app/views/shared/_analytics_head.html.erb?raw'

/**
 * The URLs the GA4 tag reports. This runs the real functions out of the ERB
 * partial rather than a copy, because every failure they guard is invisible
 * from the server: the page still renders, the tag still loads, and the URL is
 * either missing its campaign or carrying a live password-reset token.
 *
 * Both bugs pinned here were found by reading /g/collect against production on
 * 2026-08-25, after server-side tests had passed them.
 */
type Page = {
  page_location: string
  page_title: string
  content_locale: string
  page_referrer?: string
}

function extract(pattern: RegExp): string {
  const match = partialSource.match(pattern)
  if (!match) throw new Error(`not found in _analytics_head.html.erb: ${pattern}`)
  return match[0]
}

function loadCurrentPage(): () => Page {
  const parts = [
    extract(/var KEEP_QUERY = \[[\s\S]*?\];/),
    extract(/function scrubUrl\(value\) \{[\s\S]*?\n {6}\}/),
    extract(/function currentReferrer\(\) \{[\s\S]*?\n {6}\}/),
    extract(/function currentPage\(\) \{[\s\S]*?\n {6}\}/)
  ]

  return new Function(`${parts.join('\n')}\nreturn currentPage;`)() as () => Page
}

function setPage(path: string, canonicalPath = path.split('?')[0]) {
  window.history.replaceState({}, '', path)
  document.head.innerHTML = `<link rel="canonical" href="${new URL(canonicalPath, window.location.origin).href}">`
  document.title = 'Holdem Lab'
  document.documentElement.lang = 'en'
}

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true })
}

describe('the page_location reported to GA4', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    setReferrer('')
  })

  it('keeps campaign parameters from the address the visitor arrived at', () => {
    setPage('/?utm_source=youtube&utm_medium=social&utm_campaign=launch')
    const location = new URL(loadCurrentPage()().page_location)

    // Reading these off the canonical link instead drops all three silently:
    // a canonical never carries a query string.
    expect(location.searchParams.get('utm_source')).toBe('youtube')
    expect(location.searchParams.get('utm_medium')).toBe('social')
    expect(location.searchParams.get('utm_campaign')).toBe('launch')
  })

  it('drops every parameter that is not on the allowlist', () => {
    setPage('/?utm_source=youtube&token=live-secret&email=someone%40example.com')
    const location = new URL(loadCurrentPage()().page_location)

    expect(location.searchParams.get('utm_source')).toBe('youtube')
    expect(location.searchParams.has('token')).toBe(false)
    expect(location.searchParams.has('email')).toBe(false)
  })

  it('never reports a password reset token', () => {
    setPage('/passwords/live-reset-token/edit')
    const { page_location } = loadCurrentPage()()

    expect(page_location).toContain('/passwords/:token/edit')
    expect(page_location).not.toContain('live-reset-token')
  })

  it('scrubs the reset token in the Chinese edition too', () => {
    setPage('/zh/passwords/live-reset-token/edit')
    const { page_location } = loadCurrentPage()()

    expect(page_location).toContain('/zh/passwords/:token/edit')
    expect(page_location).not.toContain('live-reset-token')
  })

  it('reports the edition being read, not the browser language', () => {
    setPage('/zh/learn/position')
    document.documentElement.lang = 'zh-Hans'

    expect(loadCurrentPage()().content_locale).toBe('zh-Hans')
  })

  it('prefers the canonical path over the address bar, so a duplicate URL reports once', () => {
    setPage('/learn/position/', '/learn/position')

    expect(new URL(loadCurrentPage()().page_location).pathname).toBe('/learn/position')
  })
})

describe('the page_referrer reported to GA4', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    setReferrer('')
  })

  // GA sends document.referrer as `dr` with no scrubbing of its own. One
  // navigation away from a reset page, that is a live credential.
  it('never reports a password reset token it was referred from', () => {
    setPage('/learn')
    setReferrer(`${window.location.origin}/passwords/live-reset-token/edit`)
    const referrer = loadCurrentPage()().page_referrer ?? ''

    expect(referrer).toContain('/passwords/:token/edit')
    expect(referrer).not.toContain('live-reset-token')
  })

  it('drops non-allowlisted parameters from an internal referrer', () => {
    setPage('/learn/position')
    setReferrer(`${window.location.origin}/learn?utm_source=youtube&secret=shouldnotappear`)
    const referrer = new URL(loadCurrentPage()().page_referrer ?? '')

    expect(referrer.searchParams.get('utm_source')).toBe('youtube')
    expect(referrer.searchParams.has('secret')).toBe(false)
  })

  // An external referrer is acquisition data and is not ours to rewrite.
  it('passes an external referrer through untouched', () => {
    setPage('/')
    setReferrer('https://www.google.com/search?q=texas+holdem+position')

    expect(loadCurrentPage()().page_referrer).toBe('https://www.google.com/search?q=texas+holdem+position')
  })

  it('omits the referrer entirely when there is none', () => {
    setPage('/')

    expect(loadCurrentPage()().page_referrer).toBeUndefined()
  })
})

type GtagCall = [string, ...unknown[]]

/**
 * `dr` is stamped from gtag's ambient state, not from the event parameters, so
 * setting page_referrer on the event alone leaves gtag free to reconstruct the
 * referrer from the raw previous URL. This drives the real trackPageView() over
 * two navigations with a recording gtag to pin what the ambient state becomes.
 */
function loadTrackPageView(): { track: () => void; calls: GtagCall[] } {
  const parts = [
    extract(/var KEEP_QUERY = \[[\s\S]*?\];/),
    extract(/function scrubUrl\(value\) \{[\s\S]*?\n {6}\}/),
    extract(/function currentReferrer\(\) \{[\s\S]*?\n {6}\}/),
    extract(/function currentPage\(\) \{[\s\S]*?\n {6}\}/),
    'var loaded = true;',
    'var lastPageLocation = null;',
    extract(/function trackPageView\(\) \{[\s\S]*?\n {6}\}/)
  ]

  const calls: GtagCall[] = []
  ;(window as unknown as { gtag: (...args: GtagCall) => void }).gtag = (...args) => {
    calls.push(args)
  }

  return { track: new Function(`${parts.join('\n')}\nreturn trackPageView;`)() as () => void, calls }
}

function pageViews(calls: GtagCall[]) {
  return calls
    .filter(([kind, name]) => kind === 'event' && name === 'page_view')
    .map(([, , params]) => params as { page_location: string; page_referrer?: string })
}

function ambientSets(calls: GtagCall[]) {
  return calls.filter(([kind]) => kind === 'set').map(([, params]) => params as { page_referrer?: string })
}

describe('the referrer gtag actually stamps on a Turbo navigation', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    setReferrer('')
  })

  it('never lets a reset token become the referrer of the next page', () => {
    setPage('/passwords/live-reset-token/edit')
    const { track, calls } = loadTrackPageView()
    track()

    setPage('/learn')
    track()

    const second = pageViews(calls)[1]
    expect(second.page_referrer).toContain('/passwords/:token/edit')
    expect(second.page_referrer).not.toContain('live-reset-token')
    expect(ambientSets(calls)[1].page_referrer).toBe(second.page_referrer)
  })

  it('carries the previous page scrubbed, keeping the campaign and dropping the rest', () => {
    setPage('/learn?utm_source=youtube&secret=shouldnotappear')
    const { track, calls } = loadTrackPageView()
    track()

    setPage('/learn/position')
    track()

    const second = pageViews(calls)[1]
    expect(second.page_referrer).toContain('utm_source=youtube')
    expect(second.page_referrer).not.toContain('secret')
  })

  it('sets the ambient referrer, not just the event parameter', () => {
    setPage('/learn')
    const { track, calls } = loadTrackPageView()
    track()
    setPage('/learn/position')
    track()

    // The event parameter alone is what failed in production on 2026-08-25.
    expect(ambientSets(calls)[1].page_referrer).toBe('http://localhost:3000/learn')
  })

  it('does not re-report the same page twice', () => {
    setPage('/learn')
    const { track, calls } = loadTrackPageView()
    track()
    track()

    expect(pageViews(calls)).toHaveLength(1)
  })
})
