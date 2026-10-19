import { Card, cardKey, createStandardDeck } from '../cards/cards'
import { RNG_ALGORITHM_VERSION, Seed, shuffle } from '../rng/seeded-rng'
import { buildPots, Pot, sumContributions } from '../pots/pots'
import { compareHandRanks, evaluateBestHand, HandRank } from '../showdown/hand-evaluator'
import { HAND_EVALUATOR_VERSION, HOLDEM_RULES_VERSION } from '../versions'

export const CHIPS_PER_BIG_BLIND = 100
export const DEFAULT_STARTING_STACK = 100 * CHIPS_PER_BIG_BLIND
export const DEFAULT_SMALL_BLIND = Math.round(CHIPS_PER_BIG_BLIND / 2)
export const DEFAULT_BIG_BLIND = CHIPS_PER_BIG_BLIND

export type PlayerId = 'hero' | 'villain'
export type Seat = 'button' | 'bigBlind'
export type Street = 'preflop' | 'flop' | 'turn' | 'river'
export type Phase = 'action' | 'complete'
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allIn'

export interface PlayerState {
  readonly id: PlayerId
  readonly seat: Seat
  readonly stack: number
  readonly holeCards: readonly Card[]
  readonly streetContribution: number
  readonly totalContribution: number
  readonly folded: boolean
  readonly allIn: boolean
}

export interface ActionEntry {
  readonly sequence: number
  readonly actor: PlayerId | 'system'
  readonly type: ActionType | 'postBlind' | 'deal' | 'uncalledReturn'
  readonly street: Street
  readonly amount: number
  readonly targetContribution?: number
  readonly potAfter: number
  readonly note?: string
}

export interface Payouts {
  readonly hero: number
  readonly villain: number
}

export interface ShowdownResult {
  readonly reason: 'fold' | 'showdown'
  readonly totalPot: number
  readonly winnerIds: readonly PlayerId[]
  readonly payouts: Payouts
  readonly pots: readonly Pot[]
  readonly handRanks: Readonly<Record<PlayerId, HandRank | null>>
}

export interface GameState {
  readonly seed: string
  readonly rngAlgorithmVersion: string
  readonly ruleVersion: string
  readonly evaluatorVersion: string
  readonly heroSeat: Seat
  readonly startingStack: number
  readonly smallBlind: number
  readonly bigBlind: number
  readonly street: Street
  readonly phase: Phase
  readonly currentActor: PlayerId | null
  readonly players: Readonly<Record<PlayerId, PlayerState>>
  readonly publicCards: readonly Card[]
  readonly deck: readonly Card[]
  readonly nextCardIndex: number
  readonly pot: number
  readonly lastFullRaise: number
  readonly lastAggressor: PlayerId | null
  readonly actedSinceAggression: readonly PlayerId[]
  readonly actionHistory: readonly ActionEntry[]
  readonly showdown: ShowdownResult | null
}

export interface StartHandOptions {
  readonly seed: Seed
  readonly heroSeat?: Seat
  readonly startingStack?: number
  readonly smallBlind?: number
  readonly bigBlind?: number
  /** Test-only deterministic fixture hook; production callers should provide only a seed. */
  readonly deckOverride?: readonly Card[]
}

export interface Action {
  readonly type: ActionType
  /** For bet/raise, amount is the target street contribution, not the increment. */
  readonly amount?: number
}

export interface AmountBounds {
  readonly min: number
  readonly max: number
}

export interface LegalActions {
  readonly fold: boolean
  readonly check: boolean
  readonly call: number | null
  readonly bet: AmountBounds | null
  readonly raise: AmountBounds | null
  readonly allIn: number | null
  readonly toCall: number
  readonly currentContribution: number
  readonly highestContribution: number
}

export interface RuleError {
  readonly code: string
  readonly message: string
}

export type ActionResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: RuleError }

function playerForSeat(heroSeat: Seat, seat: Seat): PlayerId {
  if (seat === heroSeat) {
    return 'hero'
  }
  return 'villain'
}

function otherPlayer(playerId: PlayerId): PlayerId {
  return playerId === 'hero' ? 'villain' : 'hero'
}

export function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  return state.players[playerId]
}

export function getHero(state: GameState): PlayerState {
  return getPlayer(state, 'hero')
}

export function getVillain(state: GameState): PlayerState {
  return getPlayer(state, 'villain')
}

function withPlayers(state: GameState, players: Readonly<Record<PlayerId, PlayerState>>): GameState {
  return {
    ...state,
    players,
    pot: sumContributions(Object.values(players))
  }
}

function potParticipants(players: Readonly<Record<PlayerId, PlayerState>>): { playerId: PlayerId; totalContribution: number; folded: boolean }[] {
  return Object.values(players).map((player) => ({
    playerId: player.id,
    totalContribution: player.totalContribution,
    folded: player.folded
  }))
}

function appendEntry(state: GameState, entry: Omit<ActionEntry, 'sequence' | 'potAfter'>): GameState {
  const nextEntry: ActionEntry = {
    ...entry,
    sequence: state.actionHistory.length + 1,
    potAfter: state.pot
  }
  return { ...state, actionHistory: [...state.actionHistory, nextEntry] }
}

function updatePlayer(player: PlayerState, update: Partial<PlayerState>): PlayerState {
  return { ...player, ...update }
}

function postBlind(player: PlayerState, amount: number): PlayerState {
  const paid = Math.min(player.stack, amount)
  const stack = player.stack - paid
  return updatePlayer(player, {
    stack,
    streetContribution: paid,
    totalContribution: paid,
    allIn: stack === 0
  })
}

export function createInitialHand(options: StartHandOptions): GameState {
  const heroSeat = options.heroSeat ?? 'button'
  const startingStack = options.startingStack ?? DEFAULT_STARTING_STACK
  const smallBlind = options.smallBlind ?? DEFAULT_SMALL_BLIND
  const bigBlind = options.bigBlind ?? DEFAULT_BIG_BLIND
  if (!Number.isInteger(startingStack) || startingStack <= 0) {
    throw new RangeError('startingStack must be a positive integer')
  }
  if (!Number.isInteger(smallBlind) || !Number.isInteger(bigBlind) || smallBlind <= 0 || bigBlind <= smallBlind) {
    throw new RangeError('blind amounts must be positive integers with big blind larger than small blind')
  }
  if (startingStack < bigBlind) {
    throw new RangeError('startingStack must cover the big blind')
  }

  const generatedDeck = shuffle(createStandardDeck(), options.seed)
  const deck = options.deckOverride === undefined ? generatedDeck : [...options.deckOverride]
  if (deck.length !== 52 || new Set(deck.map(cardKey)).size !== 52) {
    throw new RangeError('deckOverride must contain one complete standard deck')
  }
  const buttonId = playerForSeat(heroSeat, 'button')
  const bigBlindId = playerForSeat(heroSeat, 'bigBlind')
  const holes: Record<PlayerId, Card[]> = { hero: [], villain: [] }
  let nextCardIndex = 0
  for (let round = 0; round < 2; round += 1) {
    // Heads-up dealing starts with the big blind. The button/small blind is
    // dealt last even though the button acts first before the flop.
    holes[bigBlindId].push(deck[nextCardIndex])
    nextCardIndex += 1
    holes[buttonId].push(deck[nextCardIndex])
    nextCardIndex += 1
  }

  const initialPlayers: Record<PlayerId, PlayerState> = {
    hero: {
      id: 'hero',
      seat: heroSeat,
      stack: startingStack,
      holeCards: holes.hero,
      streetContribution: 0,
      totalContribution: 0,
      folded: false,
      allIn: false
    },
    villain: {
      id: 'villain',
      seat: heroSeat === 'button' ? 'bigBlind' : 'button',
      stack: startingStack,
      holeCards: holes.villain,
      streetContribution: 0,
      totalContribution: 0,
      folded: false,
      allIn: false
    }
  }
  const withSmallBlind = postBlind(initialPlayers[playerForSeat(heroSeat, 'button')], smallBlind)
  const withBigBlind = postBlind(initialPlayers[bigBlindId], bigBlind)
  const players = {
    ...initialPlayers,
    [buttonId]: withSmallBlind,
    [bigBlindId]: withBigBlind
  }
  const state: GameState = {
    seed: String(options.seed),
    rngAlgorithmVersion: RNG_ALGORITHM_VERSION,
    ruleVersion: HOLDEM_RULES_VERSION,
    evaluatorVersion: HAND_EVALUATOR_VERSION,
    heroSeat,
    startingStack,
    smallBlind,
    bigBlind,
    street: 'preflop',
    phase: 'action',
    currentActor: buttonId,
    players,
    publicCards: [],
    deck,
    nextCardIndex,
    pot: sumContributions(Object.values(players)),
    lastFullRaise: bigBlind,
    lastAggressor: null,
    actedSinceAggression: [],
    actionHistory: [],
    showdown: null
  }
  let withBlindHistory = appendEntry(state, {
    actor: buttonId,
    type: 'postBlind',
    street: 'preflop',
    amount: smallBlind,
    note: 'small blind'
  })
  withBlindHistory = appendEntry(withBlindHistory, {
    actor: bigBlindId,
    type: 'postBlind',
    street: 'preflop',
    amount: bigBlind,
    note: 'big blind'
  })
  return withBlindHistory
}

export function getHighestContribution(state: GameState): number {
  return Math.max(state.players.hero.streetContribution, state.players.villain.streetContribution)
}

export function getToCall(state: GameState, playerId: PlayerId): number {
  return Math.max(0, getHighestContribution(state) - state.players[playerId].streetContribution)
}

export function getLegalActions(state: GameState, playerId = state.currentActor): LegalActions {
  const player = playerId === null ? null : state.players[playerId]
  const highestContribution = getHighestContribution(state)
  const currentContribution = player?.streetContribution ?? 0
  const toCall = player === null ? 0 : Math.max(0, highestContribution - currentContribution)
  const maxTarget = player === null ? 0 : currentContribution + player.stack
  const open = highestContribution === 0
  const opponent = player === null ? null : state.players[otherPlayer(player.id)]
  const canAct = state.phase === 'action' && player !== null && state.currentActor === player.id && !player.folded && !player.allIn
  if (!canAct) {
    return {
      fold: false,
      check: false,
      call: null,
      bet: null,
      raise: null,
      allIn: null,
      toCall,
      currentContribution,
      highestContribution
    }
  }

  const minBet = state.bigBlind
  const minRaiseTo = highestContribution + state.lastFullRaise
  const canRaiseAgainstOpponent = opponent !== null && !opponent.allIn
  return {
    fold: true,
    check: toCall === 0,
    call: toCall > 0 && toCall <= (player?.stack ?? 0) ? toCall : null,
    bet: open && maxTarget >= currentContribution + minBet ? { min: currentContribution + minBet, max: maxTarget } : null,
    raise: !open && canRaiseAgainstOpponent && maxTarget >= minRaiseTo ? { min: minRaiseTo, max: maxTarget } : null,
    allIn: player !== null && player.stack > 0 ? maxTarget : null,
    toCall,
    currentContribution,
    highestContribution
  }
}

function error(code: string, message: string): ActionResult {
  return { ok: false, error: { code, message } }
}

function isIntegerAmount(amount: number | undefined): amount is number {
  return amount !== undefined && Number.isInteger(amount)
}

function addActedPlayer(players: readonly PlayerId[], playerId: PlayerId): PlayerId[] {
  return players.includes(playerId) ? [...players] : [...players, playerId]
}

function addActionEntry(state: GameState, actor: PlayerId, action: Action, paid: number, targetContribution: number): GameState {
  return appendEntry(state, {
    actor,
    type: action.type,
    street: state.street,
    amount: paid,
    targetContribution
  })
}

function normalizeUncalledExcess(state: GameState): GameState {
  const activePlayers = Object.values(state.players).filter((player) => !player.folded)
  if (activePlayers.length !== 2) {
    return state
  }
  const allInPlayer = activePlayers.find((player) => player.allIn)
  if (allInPlayer === undefined) {
    return state
  }
  const other = activePlayers.find((player) => player.id !== allInPlayer.id) as PlayerState
  const excess = Math.max(0, other.streetContribution - allInPlayer.streetContribution)
  if (excess === 0) {
    return state
  }
  const returnedPlayer = updatePlayer(other, {
    stack: other.stack + excess,
    streetContribution: other.streetContribution - excess,
    totalContribution: other.totalContribution - excess,
    allIn: false
  })
  const players = { ...state.players, [other.id]: returnedPlayer }
  const withPlayersState = withPlayers(state, players)
  return appendEntry(withPlayersState, {
    actor: 'system',
    type: 'uncalledReturn',
    street: state.street,
    amount: excess,
    targetContribution: returnedPlayer.streetContribution,
    note: 'uncalled excess returned'
  })
}

function revealStreet(state: GameState, street: Street): GameState {
  const revealCount = street === 'flop' ? 3 : 1
  const nextCardIndex = state.nextCardIndex + 1
  const revealedCards = state.deck.slice(nextCardIndex, nextCardIndex + revealCount)
  if (revealedCards.length !== revealCount) {
    throw new Error('The deterministic deck ran out of cards while revealing the board')
  }
  const withBoard: GameState = {
    ...state,
    street,
    publicCards: [...state.publicCards, ...revealedCards],
    nextCardIndex: nextCardIndex + revealCount,
    currentActor: null,
    actedSinceAggression: [],
    lastFullRaise: state.bigBlind,
    lastAggressor: null
  }
  return appendEntry(withBoard, {
    actor: 'system',
    type: 'deal',
    street,
    amount: revealCount,
    note: street === 'flop' ? 'burn one, deal flop' : 'burn one, deal street card'
  })
}

function playerCanAct(player: PlayerState): boolean {
  return !player.folded && !player.allIn
}

function contributionsAreMatched(state: GameState): boolean {
  const activePlayers = Object.values(state.players).filter((player) => !player.folded)
  return activePlayers.length <= 1 || activePlayers.every((player) => player.streetContribution === getHighestContribution(state))
}

function allEligiblePlayersActed(state: GameState): boolean {
  return Object.values(state.players)
    .filter(playerCanAct)
    .every((player) => state.actedSinceAggression.includes(player.id))
}

function runoutBoard(state: GameState): GameState {
  let nextState = state
  const streets: Street[] = ['flop', 'turn', 'river']
  for (const street of streets) {
    if (nextState.publicCards.length < (street === 'flop' ? 3 : street === 'turn' ? 4 : 5)) {
      nextState = revealStreet(nextState, street)
    }
  }
  return nextState
}

function distributePayouts(
  players: Readonly<Record<PlayerId, PlayerState>>,
  pots: readonly Pot[],
  handRanks: Readonly<Record<PlayerId, HandRank | null>>,
  playerOrder: readonly PlayerId[]
): { players: Readonly<Record<PlayerId, PlayerState>>; payouts: Payouts; winnerIds: PlayerId[] } {
  const payouts: Record<PlayerId, number> = { hero: 0, villain: 0 }
  const winnerIds: PlayerId[] = []
  for (const pot of pots) {
    const eligible = pot.eligiblePlayerIds.filter((playerId): playerId is PlayerId => playerId === 'hero' || playerId === 'villain')
    if (eligible.length === 0) {
      continue
    }
    const bestRank = eligible.reduce((best, playerId) => {
      const rank = handRanks[playerId]
      if (rank === null) {
        return best
      }
      if (best === null || compareHandRanks(rank, best) > 0) {
        return rank
      }
      return best
    }, null as HandRank | null)
    const winners = eligible.filter((playerId) => {
      const rank = handRanks[playerId]
      return rank !== null && bestRank !== null && compareHandRanks(rank, bestRank) === 0
    })
    const share = Math.floor(pot.amount / winners.length)
    let remainder = pot.amount - share * winners.length
    for (const playerId of playerOrder) {
      if (winners.includes(playerId)) {
        payouts[playerId] += share + (remainder > 0 ? 1 : 0)
        if (remainder > 0) {
          remainder -= 1
        }
        if (!winnerIds.includes(playerId)) {
          winnerIds.push(playerId)
        }
      }
    }
  }

  const paidPlayers = {
    hero: updatePlayer(players.hero, { stack: players.hero.stack + payouts.hero }),
    villain: updatePlayer(players.villain, { stack: players.villain.stack + payouts.villain })
  }
  return { players: paidPlayers, payouts, winnerIds }
}

function finishByFold(state: GameState, foldedPlayerId: PlayerId): GameState {
  const winnerId = otherPlayer(foldedPlayerId)
  const totalPot = state.pot
  const payouts: Payouts = { hero: winnerId === 'hero' ? totalPot : 0, villain: winnerId === 'villain' ? totalPot : 0 }
  const players = {
    ...state.players,
    [winnerId]: updatePlayer(state.players[winnerId], { stack: state.players[winnerId].stack + totalPot }),
    [foldedPlayerId]: updatePlayer(state.players[foldedPlayerId], { folded: true })
  }
  const result: ShowdownResult = {
    reason: 'fold',
    totalPot,
    winnerIds: [winnerId],
    payouts,
    pots: buildPots(potParticipants(state.players)),
    handRanks: { hero: null, villain: null }
  }
  return {
    ...state,
    players,
    phase: 'complete',
    currentActor: null,
    pot: 0,
    showdown: result
  }
}

function finishByShowdown(state: GameState): GameState {
  const runoutState = state.publicCards.length === 5 ? state : runoutBoard(state)
  const handRanks: Record<PlayerId, HandRank | null> = { hero: null, villain: null }
  for (const player of Object.values(runoutState.players)) {
    if (!player.folded) {
      handRanks[player.id] = evaluateBestHand([...player.holeCards, ...runoutState.publicCards])
    }
  }
  const pots = buildPots(potParticipants(runoutState.players))
  const playerOrder: PlayerId[] = runoutState.heroSeat === 'button' ? ['hero', 'villain'] : ['villain', 'hero']
  const { players, payouts, winnerIds } = distributePayouts(runoutState.players, pots, handRanks, playerOrder)
  const result: ShowdownResult = {
    reason: 'showdown',
    totalPot: sumContributions(Object.values(runoutState.players)),
    winnerIds,
    payouts,
    pots,
    handRanks
  }
  return {
    ...runoutState,
    players,
    phase: 'complete',
    currentActor: null,
    pot: 0,
    showdown: result
  }
}

function advanceAfterAction(state: GameState, actor: PlayerId): GameState {
  const activePlayers = Object.values(state.players).filter((player) => !player.folded)
  if (activePlayers.length <= 1) {
    return finishByFold(state, actor)
  }

  const playersThatCanAct = activePlayers.filter(playerCanAct)
  if (playersThatCanAct.length < 2) {
    const remainingPlayer = playersThatCanAct[0]
    if (remainingPlayer !== undefined && getToCall(state, remainingPlayer.id) > 0) {
      return { ...state, currentActor: remainingPlayer.id }
    }
    return finishByShowdown(state)
  }

  if (allEligiblePlayersActed(state) && contributionsAreMatched(state)) {
    if (state.street === 'river') {
      return finishByShowdown(state)
    }
    const nextStreet: Street = state.street === 'preflop' ? 'flop' : state.street === 'flop' ? 'turn' : 'river'
    const revealed = revealStreet(state, nextStreet)
    const postflopFirstActor = playerForSeat(state.heroSeat, 'bigBlind')
    const resetPlayers = {
      hero: updatePlayer(revealed.players.hero, { streetContribution: 0 }),
      villain: updatePlayer(revealed.players.villain, { streetContribution: 0 })
    }
    return {
      ...revealed,
      players: resetPlayers,
      currentActor: postflopFirstActor,
      actedSinceAggression: [],
      lastFullRaise: state.bigBlind,
      lastAggressor: null,
      pot: sumContributions(Object.values(resetPlayers))
    }
  }

  return { ...state, currentActor: otherPlayer(actor) }
}

export function applyAction(state: GameState, actor: PlayerId, action: Action): ActionResult {
  if (state.phase !== 'action') {
    return error('hand-complete', 'This hand is complete; no further action is allowed.')
  }
  if (state.currentActor !== actor) {
    return error('wrong-actor', 'It is not this player\'s turn to act.')
  }
  const player = state.players[actor]
  if (player.folded || player.allIn) {
    return error('player-inactive', 'This player has folded or is all-in and cannot act.')
  }
  const legal = getLegalActions(state, actor)
  if (action.type === 'fold' && !legal.fold) {
    return error('illegal-fold', 'Fold is not legal in this state.')
  }
  if (action.type === 'check' && !legal.check) {
    return error('illegal-check', 'Check is not legal while facing a call amount.')
  }
  if (action.type === 'call' && legal.call === null) {
    return error('illegal-call', 'A full call is not legal; choose all-in when the stack is insufficient.')
  }
  if (action.type === 'bet' && (!legal.bet || !isIntegerAmount(action.amount) || action.amount < legal.bet.min || action.amount > legal.bet.max)) {
    return error('illegal-bet', 'The bet is outside the legal minimum and remaining-stack bounds.')
  }
  if (action.type === 'raise' && (!legal.raise || !isIntegerAmount(action.amount) || action.amount < legal.raise.min || action.amount > legal.raise.max)) {
    return error('illegal-raise', 'The raise is outside the legal minimum and remaining-stack bounds.')
  }
  if (action.type === 'allIn' && legal.allIn === null) {
    return error('illegal-all-in', 'All-in is not legal in this state.')
  }

  if (action.type === 'fold') {
    const folded = updatePlayer(player, { folded: true })
    const foldedState = withPlayers(state, { ...state.players, [actor]: folded })
    const withAction = addActionEntry(foldedState, actor, action, 0, player.streetContribution)
    return { ok: true, state: finishByFold(withAction, actor) }
  }

  const previousHighest = getHighestContribution(state)
  const currentContribution = player.streetContribution
  let targetContribution = currentContribution
  if (action.type === 'call') {
    targetContribution = previousHighest
  } else if (action.type === 'bet' || action.type === 'raise') {
    targetContribution = action.amount as number
  } else if (action.type === 'allIn') {
    targetContribution = currentContribution + player.stack
  }
  const paid = targetContribution - currentContribution
  if (paid < 0 || paid > player.stack) {
    return error('invalid-amount', 'The action amount exceeds the available stack.')
  }
  const updatedPlayer = updatePlayer(player, {
    stack: player.stack - paid,
    streetContribution: targetContribution,
    totalContribution: player.totalContribution + paid,
    allIn: player.stack - paid === 0
  })
  let nextState = withPlayers(state, { ...state.players, [actor]: updatedPlayer })
  nextState = addActionEntry(nextState, actor, action, paid, targetContribution)

  const fullAggression = targetContribution > previousHighest &&
    (previousHighest === 0 ? targetContribution >= state.bigBlind : targetContribution - previousHighest >= state.lastFullRaise)
  const actedSinceAggression = fullAggression ? [actor] : addActedPlayer(state.actedSinceAggression, actor)
  nextState = {
    ...nextState,
    actedSinceAggression,
    lastFullRaise: fullAggression
      ? previousHighest === 0
        ? targetContribution
        : targetContribution - previousHighest
      : state.lastFullRaise,
    lastAggressor: fullAggression ? actor : state.lastAggressor
  }
  nextState = normalizeUncalledExcess(nextState)
  return { ok: true, state: advanceAfterAction(nextState, actor) }
}

export function actionLabel(action: ActionType): string {
  return {
    fold: 'Fold',
    check: 'Check',
    call: 'Call',
    bet: 'Bet',
    raise: 'Raise',
    allIn: 'All-in'
  }[action]
}

export function chipsToBb(chips: number, bigBlind = DEFAULT_BIG_BLIND): number {
  return chips / bigBlind
}

export function formatChips(chips: number, bigBlind = DEFAULT_BIG_BLIND): string {
  const bb = chipsToBb(chips, bigBlind)
  return `${Number.isInteger(bb) ? bb : bb.toFixed(2)} BB`
}

export function assertUniqueCards(state: GameState): void {
  const cards = [...state.players.hero.holeCards, ...state.players.villain.holeCards, ...state.publicCards]
  const keys = cards.map(cardKey)
  if (new Set(keys).size !== keys.length) {
    throw new Error('A game state contains duplicate cards')
  }
}
