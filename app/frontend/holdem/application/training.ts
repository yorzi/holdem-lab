import { Action, applyAction, createInitialHand, GameState, getLegalActions, PlayerId, Street } from '../domain/betting/holdem'
import { TrainingMode } from '../domain/records/decision-record'

export interface ScenarioOptions {
  readonly mode: Exclude<TrainingMode, 'review'>
  readonly seed: string
  readonly focusStreet?: Street
}

export interface TrainingScenario {
  readonly id: string
  readonly mode: Exclude<TrainingMode, 'review'>
  readonly focusStreet: Street
  readonly state: GameState
  readonly opponentDescription: string
}

function deterministicHeroSeat(seed: string): 'button' | 'bigBlind' {
  let checksum = 0
  for (const character of seed) {
    checksum = (checksum + character.charCodeAt(0)) % 2
  }
  return checksum === 0 ? 'button' : 'bigBlind'
}

function fallbackAction(state: GameState, actor: PlayerId): Action {
  const legal = getLegalActions(state, actor)
  if (legal.check) return { type: 'check' }
  if (legal.call !== null) return { type: 'call' }
  if (legal.allIn !== null) return { type: 'allIn' }
  return { type: 'fold' }
}

function applyScripted(state: GameState, actor: PlayerId): GameState {
  const result = applyAction(state, actor, fallbackAction(state, actor))
  if (!result.ok) {
    throw new Error(`Unable to prepare deterministic scenario: ${result.error.message}`)
  }
  return result.state
}

/** Drive a fresh hand to a user decision on the requested street using only legal engine actions. */
export function driveToHeroDecision(initialState: GameState, targetStreet: Street): GameState {
  let state = initialState
  let guard = 0
  while (state.phase === 'action' && (state.street !== targetStreet || state.currentActor !== 'hero')) {
    if (state.currentActor === null) {
      throw new Error('Scenario preparation reached an action state without an actor')
    }
    state = applyScripted(state, state.currentActor)
    guard += 1
    if (guard > 30) {
      throw new Error('Scenario preparation exceeded the action guard')
    }
  }
  if (state.phase !== 'action' || state.currentActor !== 'hero') {
    throw new Error(`Could not prepare a hero decision on ${targetStreet}`)
  }
  return state
}

export function createTrainingScenario(options: ScenarioOptions): TrainingScenario {
  const focusStreet = options.mode === 'street' ? options.focusStreet ?? 'flop' : 'preflop'
  const initial = createInitialHand({ seed: options.seed, heroSeat: deterministicHeroSeat(options.seed) })
  const state = driveToHeroDecision(initial, focusStreet)
  return {
    id: `${options.mode}-${options.seed}-${focusStreet}`,
    mode: options.mode,
    focusStreet,
    state,
    opponentDescription: 'Deterministic practice opponent: checks when no call is pending and calls when facing a bet. It is neither human play nor a solver strategy.'
  }
}

export interface UserTurnResult {
  readonly state: GameState
  readonly opponentActions: readonly GameState['actionHistory'][number][]
}

export function applyUserActionAndOpponent(state: GameState, action: Action): UserTurnResult {
  const beforeOpponentSequence = state.actionHistory.length
  const result = applyAction(state, 'hero', action)
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  let nextState = result.state
  while (nextState.phase === 'action' && nextState.currentActor === 'villain') {
    nextState = applyScripted(nextState, 'villain')
  }
  return {
    state: nextState,
    opponentActions: nextState.actionHistory.filter((entry) => entry.sequence > beforeOpponentSequence && entry.actor === 'villain')
  }
}

export function nextScenarioSeed(counter: number): string {
  return `practice-${String(counter).padStart(3, '0')}`
}
