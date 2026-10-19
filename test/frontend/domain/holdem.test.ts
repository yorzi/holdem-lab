import { describe, expect, it } from 'vitest'
import {
  Action,
  applyAction,
  assertUniqueCards,
  CHIPS_PER_BIG_BLIND,
  createInitialHand,
  DEFAULT_STARTING_STACK,
  getHero,
  getLegalActions,
  getVillain,
  PlayerId
} from '../../../app/frontend/holdem/domain/betting/holdem'
import { Card, createCard, createStandardDeck, cardKey } from '../../../app/frontend/holdem/domain/cards/cards'
import { RNG_ALGORITHM_VERSION } from '../../../app/frontend/holdem/domain/rng/seeded-rng'
import { HAND_EVALUATOR_VERSION, HOLDEM_RULES_VERSION } from '../../../app/frontend/holdem/domain/versions'

function act(state: ReturnType<typeof createInitialHand>, actor: PlayerId, action: Action) {
  const result = applyAction(state, actor, action)
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`)
  }
  return result.state
}

describe('heads-up Hold’em state machine', () => {
  it('posts blinds, deals two cards each, and starts on the button', () => {
    const deck = createStandardDeck()
    const state = createInitialHand({ seed: 'initial-state', deckOverride: deck })

    expect(state.currentActor).toBe('hero')
    expect(state.street).toBe('preflop')
    expect(state.pot).toBe(150)
    expect(getHero(state).holeCards).toHaveLength(2)
    expect(getVillain(state).holeCards).toHaveLength(2)
    expect(getVillain(state).holeCards).toEqual([deck[0], deck[2]])
    expect(getHero(state).holeCards).toEqual([deck[1], deck[3]])
    expect(getHero(state).stack).toBe(DEFAULT_STARTING_STACK - 50)
    expect(getVillain(state).stack).toBe(DEFAULT_STARTING_STACK - 100)
    expect(state.actionHistory.map((entry) => entry.type)).toEqual(['postBlind', 'postBlind'])
    expect(() => assertUniqueCards(state)).not.toThrow()
    expect(state.ruleVersion).toBe(HOLDEM_RULES_VERSION)
    expect(state.evaluatorVersion).toBe(HAND_EVALUATOR_VERSION)
    expect(state.rngAlgorithmVersion).toBe(RNG_ALGORITHM_VERSION)
  })

  it('rejects a raise below the minimum without changing state', () => {
    const state = createInitialHand({ seed: 'minimum-raise' })
    const before = JSON.stringify(state)
    const legal = getLegalActions(state, 'hero')
    const result = applyAction(state, 'hero', { type: 'raise', amount: (legal.raise?.min ?? 0) - 1 })

    expect(result.ok).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('rejects invalid action combinations without mutating the source state', () => {
    const initial = createInitialHand({ seed: 'invalid-action-matrix' })
    const initialCases: readonly { readonly actor: PlayerId; readonly action: Action; readonly code: string }[] = [
      { actor: 'villain', action: { type: 'check' }, code: 'wrong-actor' },
      { actor: 'hero', action: { type: 'check' }, code: 'illegal-check' },
      { actor: 'hero', action: { type: 'raise', amount: 1 }, code: 'illegal-raise' }
    ]

    for (const testCase of initialCases) {
      const before = JSON.stringify(initial)
      const result = applyAction(initial, testCase.actor, testCase.action)

      expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: testCase.code }) })
      expect(JSON.stringify(initial)).toBe(before)
    }

    let noBetState = createInitialHand({ seed: 'invalid-bet-matrix', heroSeat: 'bigBlind' })
    noBetState = act(noBetState, 'villain', { type: 'call' })
    noBetState = act(noBetState, 'hero', { type: 'check' })
    const legal = getLegalActions(noBetState, 'hero')
    const postflopCases: readonly { readonly action: Action; readonly code: string }[] = [
      { action: { type: 'call' }, code: 'illegal-call' },
      { action: { type: 'bet', amount: (legal.bet?.min ?? 0) - 1 }, code: 'illegal-bet' },
      { action: { type: 'raise', amount: 1 }, code: 'illegal-raise' }
    ]

    for (const testCase of postflopCases) {
      const before = JSON.stringify(noBetState)
      const result = applyAction(noBetState, 'hero', testCase.action)

      expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: testCase.code }) })
      expect(JSON.stringify(noBetState)).toBe(before)
    }
  })

  it.each([
    { type: 'fold' as const },
    { type: 'check' as const },
    { type: 'call' as const },
    { type: 'bet' as const, amount: 50 },
    { type: 'raise' as const, amount: 100 },
    { type: 'allIn' as const }
  ])('rejects %s after settlement without changing the settled state', (action) => {
    const folded = applyAction(createInitialHand({ seed: `terminal-${action.type}` }), 'hero', { type: 'fold' })
    if (!folded.ok) throw new Error(folded.error.message)
    const before = JSON.stringify(folded.state)
    const result = applyAction(folded.state, 'hero', action)

    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'hand-complete' }) })
    expect(JSON.stringify(folded.state)).toBe(before)
  })

  it('supports a preflop raise, call, and correct postflop actor order', () => {
    let state = createInitialHand({ seed: 'preflop-flow' })
    state = act(state, 'hero', { type: 'raise', amount: 3 * CHIPS_PER_BIG_BLIND })
    expect(state.currentActor).toBe('villain')
    expect(getLegalActions(state, 'villain').toCall).toBe(200)
    state = act(state, 'villain', { type: 'call' })

    expect(state.street).toBe('flop')
    expect(state.publicCards).toHaveLength(3)
    expect(state.currentActor).toBe('villain')
    expect(state.pot).toBe(600)
    expect(getHero(state).totalContribution).toBe(300)
    expect(getVillain(state).totalContribution).toBe(300)
    expect(() => assertUniqueCards(state)).not.toThrow()
  })

  it('runs a checkdown through all streets and settles at showdown', () => {
    let state = createInitialHand({ seed: 'checkdown' })
    state = act(state, 'hero', { type: 'call' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'hero', { type: 'check' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'hero', { type: 'check' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'hero', { type: 'check' })

    expect(state.phase).toBe('complete')
    expect(state.street).toBe('river')
    expect(state.publicCards).toHaveLength(5)
    expect(state.pot).toBe(0)
    expect(state.showdown?.reason).toBe('showdown')
    expect(state.showdown?.totalPot).toBe(200)
    expect(getHero(state).stack + getVillain(state).stack).toBe(2 * DEFAULT_STARTING_STACK)
    expect(state.showdown?.payouts.hero).toBeGreaterThanOrEqual(0)
    expect(state.showdown?.payouts.villain).toBeGreaterThanOrEqual(0)
  })

  it('settles a fold immediately and makes the folded player unable to act', () => {
    const state = createInitialHand({ seed: 'fold' })
    const result = applyAction(state, 'hero', { type: 'fold' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('complete')
    expect(result.state.showdown?.reason).toBe('fold')
    expect(result.state.showdown?.winnerIds).toEqual(['villain'])
    expect(result.state.pot).toBe(0)
    expect(getVillain(result.state).stack).toBe(DEFAULT_STARTING_STACK - 100 + 150)
    expect(applyAction(result.state, 'hero', { type: 'check' }).ok).toBe(false)
  })

  it('runs out the board after a matched all-in', () => {
    let state = createInitialHand({ seed: 'all-in', startingStack: 500 })
    state = act(state, 'hero', { type: 'allIn' })
    expect(state.currentActor).toBe('villain')
    expect(getLegalActions(state, 'villain').raise).toBeNull()
    state = act(state, 'villain', { type: 'call' })

    expect(state.phase).toBe('complete')
    expect(state.publicCards).toHaveLength(5)
    expect(state.pot).toBe(0)
    expect(state.showdown?.totalPot).toBe(1000)
    expect(getHero(state).stack + getVillain(state).stack).toBe(1000)
  })

  it('splits a showdown pot when the board is the best hand for both players', () => {
    const fixture: Card[] = [
      createCard(2, 'spades'), createCard(4, 'diamonds'), createCard(3, 'spades'), createCard(5, 'diamonds'),
      createCard(9, 'clubs'), createCard(14, 'clubs'), createCard(13, 'diamonds'), createCard(12, 'hearts'),
      createCard(8, 'spades'), createCard(11, 'spades'), createCard(7, 'hearts'), createCard(10, 'clubs')
    ]
    const used = new Set(fixture.map(cardKey))
    const deck = [...fixture, ...createStandardDeck().filter((card) => !used.has(cardKey(card)))]
    let state = createInitialHand({ seed: 'split-pot', deckOverride: deck })
    state = act(state, 'hero', { type: 'call' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'hero', { type: 'check' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'hero', { type: 'check' })
    state = act(state, 'villain', { type: 'check' })
    state = act(state, 'hero', { type: 'check' })

    expect(state.showdown?.winnerIds).toEqual(['hero', 'villain'])
    expect(state.showdown?.payouts).toEqual({ hero: 100, villain: 100 })
    expect(getHero(state).stack).toBe(DEFAULT_STARTING_STACK)
    expect(getVillain(state).stack).toBe(DEFAULT_STARTING_STACK)
  })
})
