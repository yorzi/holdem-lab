import { describe, expect, it } from 'vitest'
import goldenData from '../../../data/quality/holdem-golden-v2.json'
import { assertReplayCompatibility, UnsupportedReplayVersionError } from '../../../app/frontend/holdem/application/replay'
import {
  applyAction,
  createInitialHand,
  getLegalActions,
  type Action,
  type GameState,
  type PlayerId,
  type Seat
} from '../../../app/frontend/holdem/domain/betting/holdem'
import { cardKey, createCard, createStandardDeck, type Card, type Rank, type Suit } from '../../../app/frontend/holdem/domain/cards/cards'
import { evaluateBestHand, evaluateFiveCardHand } from '../../../app/frontend/holdem/domain/showdown/hand-evaluator'
import { HAND_EVALUATOR_VERSION, HOLDEM_RULES_VERSION } from '../../../app/frontend/holdem/domain/versions'
import { RNG_ALGORITHM_VERSION } from '../../../app/frontend/holdem/domain/rng/seeded-rng'

type GoldenAction = { readonly actor: PlayerId; readonly type: Action['type']; readonly amount?: number }
type GoldenScenario = (typeof goldenData.scenarios)[number]

const RANKS: Readonly<Record<string, Rank>> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14
}
const SUITS: Readonly<Record<string, Suit>> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

function parseCard(value: string): Card {
  const rank = RANKS[value[0]]
  const suit = SUITS[value[1]]
  if (rank === undefined || suit === undefined || value.length !== 2) throw new TypeError(`Invalid golden card: ${value}`)
  return createCard(rank, suit)
}

function actionFor(value: GoldenAction): Action {
  return value.amount === undefined ? { type: value.type } : { type: value.type, amount: value.amount }
}

function applyTrace(state: GameState, actions: readonly GoldenAction[]): GameState {
  let current = state
  for (const [index, step] of actions.entries()) {
    const result = applyAction(current, step.actor, actionFor(step))
    if (!result.ok) throw new Error(`Golden action ${index + 1} failed: ${result.error.code}`)
    current = result.state
  }
  return current
}

function expectState(state: GameState, expected: Record<string, unknown>): void {
  if ('phase' in expected) expect(state.phase).toBe(expected.phase)
  if ('street' in expected) expect(state.street).toBe(expected.street)
  if ('current_actor' in expected) expect(state.currentActor).toBe(expected.current_actor)
  if ('public_card_count' in expected) expect(state.publicCards).toHaveLength(expected.public_card_count as number)
  if ('pot' in expected) expect(state.pot).toBe(expected.pot)
  if ('winner_ids' in expected) expect(state.showdown?.winnerIds).toEqual(expected.winner_ids)
  if ('showdown_reason' in expected) expect(state.showdown?.reason).toBe(expected.showdown_reason)
  if ('showdown_total_pot' in expected) expect(state.showdown?.totalPot).toBe(expected.showdown_total_pot)
}

function runScenario(scenario: GoldenScenario): void {
  const fixture = scenario as unknown as Record<string, unknown>
  switch (scenario.kind) {
    case 'initial_deal': {
      const deck = createStandardDeck()
      const state = createInitialHand({ seed: scenario.id, heroSeat: fixture.hero_seat as Seat, deckOverride: deck })
      const indices = (values: unknown): Card[] => (values as number[]).map((index) => deck[index])
      expect(state.players.hero.holeCards).toEqual(indices(fixture.expected_hero_deck_indices))
      expect(state.players.villain.holeCards).toEqual(indices(fixture.expected_villain_deck_indices))
      break
    }
    case 'state_versions': {
      const state = createInitialHand({ seed: scenario.id })
      expect(state.ruleVersion).toBe(HOLDEM_RULES_VERSION)
      expect(state.evaluatorVersion).toBe(HAND_EVALUATOR_VERSION)
      expect(state.rngAlgorithmVersion).toBe(RNG_ALGORITHM_VERSION)
      break
    }
    case 'initial_actor': {
      const state = createInitialHand({ seed: scenario.id, heroSeat: fixture.hero_seat as Seat })
      expect(state.currentActor).toBe(fixture.expected_actor)
      break
    }
    case 'initial_chips': {
      const state = createInitialHand({ seed: scenario.id })
      const button = Object.values(state.players).find((player) => player.seat === 'button')
      const bigBlind = Object.values(state.players).find((player) => player.seat === 'bigBlind')
      expect(state.pot).toBe(fixture.expected_pot)
      expect(button?.totalContribution).toBe(fixture.expected_button_contribution)
      expect(bigBlind?.totalContribution).toBe(fixture.expected_big_blind_contribution)
      break
    }
    case 'initial_legal': {
      const state = createInitialHand({ seed: scenario.id })
      const legal = getLegalActions(state, 'hero')
      expect(legal.toCall).toBe(fixture.expected_to_call)
      expect(legal.raise?.min).toBe(fixture.expected_raise_min)
      break
    }
    case 'trace': {
      const state = createInitialHand({ seed: scenario.id, startingStack: fixture.starting_stack as number | undefined })
      const result = applyTrace(state, fixture.actions as GoldenAction[])
      expectState(result, fixture.expected as Record<string, unknown>)
      const deckKeys = new Set(result.deck.map(cardKey))
      const exposedCards = [...result.players.hero.holeCards, ...result.players.villain.holeCards, ...result.publicCards]
      expect(result.deck).toHaveLength(52)
      expect(deckKeys.size).toBe(52)
      expect(new Set(exposedCards.map(cardKey)).size).toBe(exposedCards.length)
      expect(exposedCards.every((card) => deckKeys.has(cardKey(card)))).toBe(true)
      break
    }
    case 'invalid_action': {
      const state = applyTrace(createInitialHand({ seed: scenario.id }), fixture.actions as GoldenAction[])
      const before = JSON.stringify(state)
      const attempt = fixture.attempt as GoldenAction
      const result = applyAction(state, attempt.actor, actionFor(attempt))
      expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: fixture.expected_error }) })
      expect(JSON.stringify(state)).toBe(before)
      break
    }
    case 'five_card_rank':
    case 'best_hand_rank': {
      const cards = (fixture.cards as string[]).map(parseCard)
      const rank = scenario.kind === 'five_card_rank' ? evaluateFiveCardHand(cards) : evaluateBestHand(cards)
      expect(rank.category).toBe(fixture.expected_category)
      if (fixture.expected_tiebreakers !== undefined) expect(rank.tiebreakers).toEqual(fixture.expected_tiebreakers)
      break
    }
    case 'pot_odds': {
      const potBeforeBet = fixture.pot_before_bet as number
      const callAmount = fixture.call_amount as number
      const finalPotAfterCall = potBeforeBet + callAmount + callAmount
      const threshold = callAmount / finalPotAfterCall
      const betFraction = callAmount / potBeforeBet
      expect(threshold).toBeCloseTo(fixture.expected_threshold as number, 12)
      expect(threshold).toBeCloseTo(betFraction / (1 + 2 * betFraction), 12)
      break
    }
    case 'replay_rejection': {
      try {
        assertReplayCompatibility({ version: fixture.record_version })
        throw new Error('Expected the legacy replay record to be rejected')
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedReplayVersionError)
        expect((error as UnsupportedReplayVersionError).code).toBe(fixture.expected_error_code)
      }
      break
    }
    default:
      throw new TypeError(`Unknown golden scenario kind: ${String((scenario as { kind?: unknown }).kind)}`)
  }
}

describe(`quality suite ${goldenData.suite_id}`, () => {
  it('contains the required bounded review set and keeps domain review explicit', () => {
    expect(goldenData.scenarios.length).toBeGreaterThanOrEqual(20)
    expect(goldenData.scenarios.length).toBeLessThanOrEqual(30)
    expect(goldenData.domain_review.status).toBe('pending')
  })

  it.each(goldenData.scenarios)('$id', (scenario) => {
    runScenario(scenario)
  })
})
