import type { Action, ActionEntry, ActionType, Street } from '../domain/betting/holdem'
import type { DecisionRecord, ErrorTag, FeedbackLabel, StrategyFeedback } from '../domain/records/decision-record'
import type { HandCategory } from '../domain/showdown/hand-evaluator'

export type UiLocale = 'en' | 'zh'

export interface UiCopy {
  readonly aria: {
    readonly hiddenCard: string
    readonly emptyCard: string
    readonly trainerWorkspaces: string
    readonly focusStreet: string
    readonly decisionDetail: string
    readonly cardRecognitionDrills: string
  }
  readonly street: Readonly<Record<Street, string>>
  readonly action: Readonly<Record<ActionType, string>>
  readonly player: {
    readonly you: string
    readonly opponent: string
    readonly practiceOpponent: string
    readonly yourDecision: string
    readonly committed: string
    readonly folded: string
    readonly allIn: string
  }
  readonly table: {
    readonly localTable: string
    readonly makeDecision: string
    readonly inPlay: string
    readonly settled: string
    readonly communityBoard: string
    readonly pot: string
    readonly actionStream: string
    readonly waiting: string
    readonly system: string
  }
  readonly decision: {
    readonly quiz: string
    readonly yourDecision: string
    readonly answerSpot: string
    readonly yourAction: string
    readonly locked: string
    readonly localOnly: string
    readonly toCall: string
    readonly effectiveStack: string
    readonly reasonToggle: string
    readonly reasonToggleHint: string
    readonly whyAction: string
    readonly reasonPlaceholder: string
    readonly confidence: string
    readonly confidenceOptions: readonly string[]
    readonly fold: string
    readonly check: string
    readonly call: string
    readonly allIn: string
    readonly betTo: string
    readonly raiseTo: string
    readonly bet: string
    readonly raise: string
    readonly hint: string
    readonly complete: string
    readonly actionError: (minimum: number, maximum: number) => string
    readonly rejected: string
  }
  readonly feedback: {
    readonly postDecision: string
    readonly transparentApproximation: string
    readonly baselineDirection: string
    readonly potOdds: string
    readonly estimatedEquity: string
    readonly evLoss: string
    readonly notProvided: string
    readonly method: string
    readonly assumptions: string
    readonly source: string
  }
  readonly replay: {
    readonly deterministic: string
    readonly title: string
    readonly description: string
    readonly button: string
    readonly verified: string
    readonly playerActions: string
    readonly handComplete: string
    readonly decisionPending: string
    readonly heroHand: string
    readonly board: string
    readonly mismatch: string
    readonly rejected: string
  }
  readonly review: {
    readonly legacy: string
    readonly legacyDetails: string
    readonly explicitImport: string
    readonly keepRailsCopy: string
    readonly userTriggered: string
    readonly importDescription: string
    readonly importing: string
    readonly importLocal: string
    readonly nothingToImport: string
    readonly ready: (count: number) => string
    readonly importComplete: string
    readonly importSummary: (accepted: number, claimed: number, duplicates: number, conflicts: number) => string
    readonly originalsRemain: string
    readonly importFailed: string
    readonly conflict: (count: number) => string
    readonly retryImport: string
    readonly localOnly: string
    readonly serverDisabled: string
    readonly disabledDescription: string
    readonly localQueue: string
    readonly title: string
    readonly saved: (count: number) => string
    readonly recordsDescription: string
    readonly recordsDescriptionNoImport: string
    readonly empty: string
    readonly decisionRecord: string
    readonly yourHand: string
    readonly yourReason: string
    readonly noReason: string
    readonly confidenceBeforeFeedback: string
    readonly outcomeTag: string
    readonly assumptionsTimeline: string
    readonly selectSaved: string
    readonly mode: Readonly<Record<'live' | 'quiz' | 'street', string>>
  }
  readonly main: {
    readonly eyebrow: string
    readonly titleFirst: string
    readonly titleSecond: string
    readonly boundary: string
    readonly workspaces: Readonly<Record<'live' | 'quiz' | 'street' | 'review' | 'library', { readonly title: string; readonly description: string }>>
    readonly focusStreet: string
    readonly yourStack: string
    readonly opponent: string
    readonly effective: string
    readonly street: string
    readonly handResult: string
    readonly heroWins: string
    readonly villainWins: string
    readonly split: string
    readonly resultDescription: string
    readonly nextHand: string
    readonly evidenceBoundary: string
    readonly evidenceDescription: string
  }
  readonly drill: {
    readonly libraryTitle: string
    readonly libraryDescription: string
    readonly tabs: Readonly<Record<'cardNotation' | 'bestFive', string>>
    readonly tablist: string
    readonly verifiedRecognition: string
    readonly notationTitle: string
    readonly notationDescription: string
    readonly holeCards: string
    readonly classification: string
    readonly notationQuestion: string
    readonly notationExplanation: string
    readonly evaluatorIdentity: string
    readonly bestFiveTitle: string
    readonly bestFiveDescription: string
    readonly board: string
    readonly categoryQuestion: string
    readonly evaluatorExplanation: (cards: string) => string
    readonly answered: string
    readonly accuracy: string
    readonly bestStreak: string
    readonly correct: string
    readonly reviewThis: string
    readonly answer: string
    readonly nextQuestion: string
  }
}

const EN_COPY: UiCopy = {
  aria: {
    hiddenCard: 'Hidden card',
    emptyCard: 'Empty card',
    trainerWorkspaces: 'Trainer workspaces',
    focusStreet: 'Focus street',
    decisionDetail: 'Decision detail',
    cardRecognitionDrills: 'Card-recognition drills'
  },
  street: { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' },
  action: { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', allIn: 'All-in' },
  player: {
    you: 'You',
    opponent: 'Opponent',
    practiceOpponent: 'Practice opponent',
    yourDecision: 'Your decision',
    committed: 'Committed',
    folded: 'Folded',
    allIn: 'All-in'
  },
  table: {
    localTable: 'Practice table · heads-up · 100BB',
    makeDecision: 'Make one decision at a time.',
    inPlay: 'In play',
    settled: 'Settled',
    communityBoard: 'Community board',
    pot: 'Pot',
    actionStream: 'Action stream',
    waiting: 'Waiting for your first action',
    system: 'System'
  },
  decision: {
    quiz: 'Quiz / random spot',
    yourDecision: 'Your decision',
    answerSpot: 'Answer the spot',
    yourAction: 'Your action',
    locked: 'Decision locked',
    localOnly: 'Local only',
    toCall: 'To call',
    effectiveStack: 'Effective stack',
    reasonToggle: 'Add a reasoning note',
    reasonToggleHint: 'Optional · saved with this decision for review',
    whyAction: 'Why this action?',
    reasonPlaceholder: 'Write the information, range assumption, and plan you are using…',
    confidence: 'Confidence before feedback',
    confidenceOptions: ['1 · Guessing', '2 · Uncertain', '3 · Reasonable', '4 · Confident', '5 · Clear'],
    fold: 'Fold',
    check: 'Check',
    call: 'Call',
    allIn: 'All-in',
    betTo: 'Bet to',
    raiseTo: 'Raise to',
    bet: 'Bet',
    raise: 'Raise',
    hint: 'Optional. Your note is saved for the review afterwards. It does not change how the hand plays out.',
    complete: 'This hand is finished. Deal a new one, or switch to Street Focus to drill a single street.',
    actionError: (minimum, maximum) => `The target size must be between ${minimum} and ${maximum} BB.`,
    rejected: 'That is not a legal action here.'
  },
  feedback: {
    postDecision: 'Post-decision review',
    transparentApproximation: 'Transparent approximation',
    baselineDirection: 'Baseline direction:',
    potOdds: 'Pot odds',
    estimatedEquity: 'Estimated equity',
    evLoss: 'EV loss',
    notProvided: 'Not provided',
    method: 'Method',
    assumptions: 'Show assumptions and evidence',
    source: 'Source:'
  },
  replay: {
    deterministic: 'Hand replay',
    title: 'Play this hand back',
    description: 'Deal the same cards and actions again, exactly as they happened, so you can study the spot without the result in front of you.',
    button: 'Replay this hand',
    verified: 'The replay matched your saved hand.',
    playerActions: 'player actions',
    handComplete: 'hand complete',
    decisionPending: 'decision pending',
    heroHand: 'Hero hand',
    board: 'Board',
    mismatch: 'The replay finished, but it did not match your saved hand.',
    rejected: 'The hand could not be replayed:'
  },
  review: {
    legacy: 'Some older reviews are not shown.',
    legacyDetails: 'They were recorded before a correction to the heads-up deal order, so replaying them would not match how a hand is dealt now. They are still saved in this browser and nothing was deleted.',
    explicitImport: 'Save a copy to your account',
    keepRailsCopy: 'Only when you ask for it.',
    userTriggered: 'You choose',
    importDescription: 'Send a copy of your saved reviews to your Holdem Lab account so they follow you to another device. Nothing is uploaded automatically, and the originals stay in this browser either way.',
    importing: 'Saving a copy of your reviews…',
    importLocal: 'Save reviews to my account',
    nothingToImport: 'Nothing to save yet.',
    ready: (count) => `${count} saved review${count === 1 ? '' : 's'} ready to copy.`,
    importComplete: 'Saved to your account.',
    importSummary: (accepted, claimed, duplicates, conflicts) => `${accepted} new · ${claimed} linked to this account · ${duplicates} already saved · ${conflicts} could not be matched.`,
    originalsRemain: 'Your originals are still here in this browser.',
    importFailed: 'Could not save:',
    conflict: (count) => `${count} review${count === 1 ? '' : 's'} did not match what your account already had, so nothing there was overwritten.`,
    retryImport: 'Nothing in this browser changed. You can try again.',
    localOnly: 'Stays on this device',
    serverDisabled: 'Saving to an account is turned off here.',
    disabledDescription: 'Your reviews stay in this browser. Nothing is uploaded in the background.',
    localQueue: 'Your review queue',
    title: 'Review the decision, not just the result.',
    saved: (count) => `${count} saved`,
    recordsDescription: 'Your reviews are kept in this browser by default. The button above sends a copy to your account; the original is never altered.',
    recordsDescriptionNoImport: 'Your reviews are kept in this browser. There is nowhere else for them to go from here.',
    empty: 'Your first decision will appear here.',
    decisionRecord: 'Saved decision',
    yourHand: 'Your hand',
    yourReason: 'Your reason',
    noReason: 'No reason recorded.',
    confidenceBeforeFeedback: 'Confidence before feedback:',
    outcomeTag: 'Outcome tag',
    assumptionsTimeline: 'Show assumptions and the hand history',
    selectSaved: 'Pick a saved decision to see its cards, your reason, the feedback and how the hand played out.',
    mode: { live: 'Live Practice', quiz: 'Quiz / Random Spot', street: 'Street Focus' }
  },
  main: {
    eyebrow: 'No-limit Hold’em · practice table',
    titleFirst: 'Practice the decision,',
    titleSecond: 'then inspect the evidence.',
    boundary: 'Virtual chips only. Cards, legal actions and showdowns follow the rules of No-Limit Hold’em, and any hand can be replayed exactly as it was dealt.',
    workspaces: {
      live: { title: 'Live Practice', description: 'Play a heads-up hand, one decision at a time.' },
      quiz: { title: 'Quiz / Random Spot', description: 'Answer a single spot before reading the feedback.' },
      street: { title: 'Street Focus', description: 'Jump straight to a decision on one street.' },
      review: { title: 'Review Queue', description: 'Saved decisions will appear here.' },
      library: { title: 'Drill Library', description: 'Quick drills for reading cards accurately.' }
    },
    focusStreet: 'Focus street',
    yourStack: 'Your stack',
    opponent: 'Opponent',
    effective: 'Effective',
    street: 'Street',
    handResult: 'Hand result',
    heroWins: 'You win this hand.',
    villainWins: 'Opponent wins this hand.',
    split: 'The pot is split.',
    resultDescription: 'How this hand turned out says little about how well you chose. Your decision has been saved so you can review it.',
    nextHand: 'Deal the next hand',
    evidenceBoundary: 'Evidence boundary:',
    evidenceDescription: 'feedback is an estimate. It samples random opponent hands to approximate your equity, which makes it a useful teaching signal and nothing more. It is not solver output and not a claim about optimal play.'
  },
  drill: {
    libraryTitle: 'Read the cards without hesitating.',
    libraryDescription: 'Two short drills for the reflexes every other decision sits on: naming a starting hand correctly, and spotting the best five-card hand on a finished board.',
    tabs: { cardNotation: 'Starting-hand notation', bestFive: 'Best five' },
    tablist: 'Card-recognition drills',
    verifiedRecognition: 'Card notation',
    notationTitle: 'Read a starting hand precisely.',
    notationDescription: 'Use descending ranks, s for suited, o for offsuit, and no suffix for a pocket pair.',
    holeCards: 'Hole cards',
    classification: 'Classification:',
    notationQuestion: 'Which notation is correct?',
    notationExplanation: 'This answer follows the standard rank-and-suitedness notation only. It makes no claim about range membership or strategic action.',
    evaluatorIdentity: 'Best-hand reading',
    bestFiveTitle: 'Choose the best five-card hand.',
    bestFiveDescription: 'Read all seven cards, then identify the category of the strongest legal five-card combination.',
    board: 'Board',
    categoryQuestion: 'What is the best hand category?',
    evaluatorExplanation: (cards) => `The best five are ${cards}. That is only what the hand is, not an estimate of how often it wins or advice on how to play it.`,
    answered: 'Answered',
    accuracy: 'Accuracy',
    bestStreak: 'Best streak',
    correct: 'Correct',
    reviewThis: 'Review this',
    answer: 'Answer:',
    nextQuestion: 'Next question →'
  }
}

const ZH_COPY: UiCopy = {
  ...EN_COPY,
  aria: {
    hiddenCard: '隐藏的牌',
    emptyCard: '空牌位',
    trainerWorkspaces: '练习区',
    focusStreet: '选择街',
    decisionDetail: '决定详情',
    cardRecognitionDrills: '识牌练习'
  },
  street: { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' },
  action: { fold: '弃牌 Fold', check: '过牌 Check', call: '跟注 Call', bet: '下注 Bet', raise: '加注 Raise', allIn: '全下 All-in' },
  player: {
    you: '你',
    opponent: '对手',
    practiceOpponent: '练习对手',
    yourDecision: '你的决定',
    committed: '已投入',
    folded: '已弃牌',
    allIn: 'All-in'
  },
  table: {
    localTable: '练习牌桌 · 单挑 · 100BB',
    makeDecision: '一次只做一个决定。',
    inPlay: '进行中',
    settled: '已结算',
    communityBoard: '公共牌面',
    pot: 'Pot',
    actionStream: '行动记录',
    waiting: '等待你的第一个动作',
    system: '系统'
  },
  decision: {
    quiz: '随堂题 / 随机牌局',
    yourDecision: '你的决定',
    answerSpot: '回答这个牌局',
    yourAction: '你的动作',
    locked: '决定已锁定',
    localOnly: '只存在本机',
    toCall: '需跟注',
    effectiveStack: '有效筹码',
    reasonToggle: '添加一条思考记录',
    reasonToggleHint: '可选 · 会随这次决定保存，供之后复盘',
    whyAction: '为什么这样打？',
    reasonPlaceholder: '写下你依据的信息、对对手范围的假设，以及后续打算……',
    confidence: '反馈前的信心',
    confidenceOptions: ['1 · 猜测', '2 · 不确定', '3 · 基本确定', '4 · 有信心', '5 · 清楚'],
    fold: '弃牌 Fold',
    check: '过牌 Check',
    call: '跟注 Call',
    allIn: '全下 All-in',
    betTo: '下注至 Bet to',
    raiseTo: '加注至 Raise to',
    bet: '下注 Bet',
    raise: '加注 Raise',
    hint: '可选。你写下的内容会留到之后复盘用，它不会影响这手牌怎么走。',
    complete: '这手牌结束了。可以再发一手，或者切换到「单街专练」只练某一条街。',
    actionError: (minimum, maximum) => `下注尺寸必须在 ${minimum} 到 ${maximum} BB 之间。`,
    rejected: '这个动作在当前局面下不合法。'
  },
  feedback: {
    postDecision: '决定后复盘',
    transparentApproximation: '透明的估算分析',
    baselineDirection: '基准线方向：',
    potOdds: '底池赔率',
    estimatedEquity: '估算胜率',
    evLoss: '期望值损失',
    notProvided: '未提供',
    method: '方法',
    assumptions: '显示假设与证据',
    source: '来源：'
  },
  replay: {
    deterministic: '牌局回放',
    title: '把这手牌重放一遍',
    description: '按当时的发牌和动作原样再走一遍，让你在看不到结果的情况下重新研究这个局面。',
    button: '重放这手牌',
    verified: '回放结果与你保存的这手牌一致。',
    playerActions: '个动作',
    handComplete: '牌局已结束',
    decisionPending: '等待决定',
    heroHand: '你的手牌',
    board: '牌面',
    mismatch: '回放走完了，但和你保存的这手牌对不上。',
    rejected: '这手牌无法回放：'
  },
  review: {
    legacy: '有一些较早的复盘记录没有显示。',
    legacyDetails: '它们是在单挑发牌顺序更正之前记录的，重放时会和现在的发牌对不上。这些记录仍然保存在你的浏览器里，没有被删除。',
    explicitImport: '同步一份到账户',
    keepRailsCopy: '只在你主动要求时。',
    userTriggered: '由你决定',
    importDescription: '把已保存的复盘记录同步一份到你的 Holdem Lab 账户，换设备时也能看到。系统不会自动上传，本地原件无论如何都保留在这个浏览器里。',
    importing: '正在同步复盘记录……',
    importLocal: '同步复盘记录到账户',
    nothingToImport: '暂时没有可同步的内容。',
    ready: (count) => `${count} 条复盘记录可以同步。`,
    importComplete: '已同步到你的账户。',
    importSummary: (accepted, claimed, duplicates, conflicts) => `新增 ${accepted} 条 · 绑定到账户 ${claimed} 条 · 已存在 ${duplicates} 条 · 无法匹配 ${conflicts} 条。`,
    originalsRemain: '本地原件仍然留在这个浏览器里。',
    importFailed: '同步失败：',
    conflict: (count) => `有 ${count} 条记录与账户中已有的内容不一致，账户里的原有记录没有被覆盖。`,
    retryImport: '浏览器里的记录没有任何改动，你可以再试一次。',
    localOnly: '只留在本机',
    serverDisabled: '当前环境未开启同步到账户。',
    disabledDescription: '复盘记录保存在这个浏览器里，不会在后台上传。',
    localQueue: '你的复盘队列',
    title: '复盘决定，而不只是结果。',
    saved: (count) => `${count} 条已保存`,
    recordsDescription: '复盘记录默认保存在这个浏览器里。上面的按钮会同步一份副本到账户，原始记录不会被改动。',
    recordsDescriptionNoImport: '复盘记录保存在这个浏览器里，目前没有其他去处。',
    empty: '你的第一个决定会出现在这里。',
    decisionRecord: '已保存的决定',
    yourHand: '你的手牌',
    yourReason: '你的理由',
    noReason: '没有记录理由。',
    confidenceBeforeFeedback: '反馈前的信心：',
    outcomeTag: '结果标签',
    assumptionsTimeline: '显示假设与这手牌的过程',
    selectSaved: '选一条已保存的决定，看它的牌面、你的理由、反馈，以及这手牌后来怎么走的。',
    mode: { live: '实战练习', quiz: '随堂题 / 随机牌局', street: '单街专练' }
  },
  main: {
    eyebrow: '无限注德州扑克 · 练习牌桌',
    titleFirst: '练习这个决定，',
    titleSecond: '再检查证据。',
    boundary: '只使用虚拟筹码。发牌、合法动作与摊牌都遵循无限注德州扑克的规则，任何一手牌都能按当时的发牌原样重放。',
    workspaces: {
      live: { title: '实战练习', description: '一次做一个决定，完整打完一手单挑。' },
      quiz: { title: '随堂题 / 随机牌局', description: '先在一个局面上作答，再看反馈。' },
      street: { title: '单街专练', description: '直接跳到某一条街上的决定。' },
      review: { title: '复盘队列', description: '保存下来的决定会出现在这里。' },
      library: { title: '识牌练习', description: '把牌读准的快速练习。' }
    },
    focusStreet: '选择街',
    yourStack: '你的筹码',
    opponent: '对手',
    effective: '有效筹码',
    street: '当前街',
    handResult: '牌局结果',
    heroWins: '你赢下这手牌。',
    villainWins: '对手赢下这手牌。',
    split: '底池平分。',
    resultDescription: '这手牌的输赢，说明不了你打得好不好。这个决定已经保存下来，随时可以复盘。',
    nextHand: '发下一手牌',
    evidenceBoundary: '证据边界：',
    evidenceDescription: '反馈是估算结果。它通过抽样随机的对手手牌来近似你的胜率，因此只是一个有用的教学参考。它不是 solver 输出，也不代表最优打法。'
  },
  drill: {
    libraryTitle: '把牌读准，不用犹豫。',
    libraryDescription: '两个短练习，针对其他所有决定都要用到的基本功：准确叫出起手牌，以及在完整牌面上认出最强的五张。',
    tabs: { cardNotation: '起手牌写法', bestFive: '最佳五张' },
    tablist: '识牌练习',
    verifiedRecognition: '起手牌写法',
    notationTitle: '准确读出起手牌。',
    notationDescription: '按点数从大到小写；s 表示同花，o 表示不同花，口袋对子不加后缀。',
    holeCards: '手牌',
    classification: '分类：',
    notationQuestion: '哪种写法是正确的？',
    notationExplanation: '这个答案只涉及标准的点数与花色写法，不判断它属于哪个范围，也不建议怎么打。',
    evaluatorIdentity: '已核对的牌型',
    bestFiveTitle: '选出最好的五张牌。',
    bestFiveDescription: '看完七张牌，判断能组成的最强五张属于哪一类牌型。',
    board: '牌面',
    categoryQuestion: '最强的牌型是什么？',
    evaluatorExplanation: (cards) => `最好的五张是 ${cards}。这只是牌型判定，不是胜率估算，也不是打法建议。`,
    answered: '已回答',
    accuracy: '正确率',
    bestStreak: '最佳连胜',
    correct: '正确',
    reviewThis: '复习这个问题',
    answer: '答案：',
    nextQuestion: '下一题 →'
  }
}

export function getUiCopy(locale: UiLocale): UiCopy {
  return locale === 'zh' ? ZH_COPY : EN_COPY
}

export function getDocumentLocale(): UiLocale {
  return document.querySelector<HTMLMetaElement>('meta[name="holdem-locale"]')?.content === 'zh' ? 'zh' : 'en'
}

export function actionText(action: Action, locale: UiLocale): string {
  const copy = getUiCopy(locale)
  return copy.action[action.type]
}

export function actionEntryText(entry: ActionEntry, locale: UiLocale): string {
  if (locale === 'en') return `${entry.actor} · ${entry.type}${entry.amount > 0 ? ` · ${entry.amount}` : ''}`

  const copy = getUiCopy(locale)
  const actor = entry.actor === 'hero' ? copy.player.you : entry.actor === 'villain' ? copy.player.opponent : copy.table.system
  const type: Record<ActionEntry['type'], string> = {
    ...copy.action,
    postBlind: locale === 'zh' ? '发盲注 Post blind' : 'Post blind',
    deal: locale === 'zh' ? '发牌 Deal' : 'Deal',
    uncalledReturn: locale === 'zh' ? '退回未跟注筹码 Uncalled return' : 'Uncalled return'
  }
  return `${actor} ${type[entry.type]}${entry.amount > 0 ? ` · ${entry.amount}` : ''}`
}

export function actionStreamEntryText(entry: ActionEntry, locale: UiLocale): string {
  if (locale === 'en') {
    const copy = getUiCopy(locale)
    const actor = entry.actor === 'hero' ? copy.player.you : entry.actor === 'villain' ? copy.player.opponent : copy.table.system
    return `${actor} ${entry.type}`
  }

  return actionEntryText(entry, locale)
}

export function handCategoryText(category: HandCategory, locale: UiLocale): string {
  const labels: Record<UiLocale, Record<HandCategory, string>> = {
    en: {
      'high-card': 'High card',
      pair: 'Pair',
      'two-pair': 'Two pair',
      'three-of-a-kind': 'Three of a kind',
      straight: 'Straight',
      flush: 'Flush',
      'full-house': 'Full house',
      'four-of-a-kind': 'Four of a kind',
      'straight-flush': 'Straight flush'
    },
    zh: {
      'high-card': '高牌 High card',
      pair: '一对 Pair',
      'two-pair': '两对 Two pair',
      'three-of-a-kind': '三条 Three of a kind',
      straight: '顺子 Straight',
      flush: '同花 Flush',
      'full-house': '葫芦 Full house',
      'four-of-a-kind': '四条 Four of a kind',
      'straight-flush': '同花顺 Straight flush'
    }
  }
  return labels[locale][category]
}

export function describeActionText(action: Action, bigBlind: number, locale: UiLocale): string {
  const text = actionText(action, locale)
  if (action.type === 'bet' || action.type === 'raise') {
    return `${text} to ${(action.amount ?? 0) / bigBlind} BB`
  }
  return text
}

export function errorTagTextFor(tag: ErrorTag, locale: UiLocale): string {
  const labels: Record<UiLocale, Record<ErrorTag, string>> = {
    en: { over_calling: 'Over-calling', over_folding: 'Over-folding', poor_bet_sizing: 'Poor bet sizing' },
    zh: { over_calling: '过度跟注 Over-calling', over_folding: '过度弃牌 Over-folding', poor_bet_sizing: '下注尺寸不佳 Poor bet sizing' }
  }
  return labels[locale][tag]
}

export function feedbackLabelTextFor(label: FeedbackLabel, locale: UiLocale): string {
  const labels: Record<UiLocale, Record<FeedbackLabel, string>> = {
    en: { benchmark_strategy: 'Benchmark strategy', approximate_analysis: 'Approximate analysis', solver_data: 'Solver data' },
    zh: { benchmark_strategy: 'Benchmark strategy', approximate_analysis: 'Approximate analysis', solver_data: 'Solver data' }
  }
  return labels[locale][label]
}

export function recordOutcomeText(record: DecisionRecord, locale: UiLocale): string {
  if (record.errorTags.length === 0) return locale === 'zh' ? '可以复盘' : 'Ready to review'
  return record.errorTags.map((tag) => errorTagTextFor(tag, locale)).join(', ')
}

function localizedAssumption(assumption: string): string {
  const sampleMatch = assumption.match(/^Samples (\d+) random opponent hands/)
  if (sampleMatch) return `抽取 ${sampleMatch[1]} 手随机的对手牌，估算你的获胜频率。`
  if (assumption.startsWith('Compares only the chips')) return '只比较当下投入的筹码，不考虑后续街、对手真实的牌范围，也不计入位置带来的价值。'
  if (assumption.startsWith('This is an estimate')) return '这是用于练习的估算，不是 solver 输出，也不代表最优打法。'
  return assumption
}

export function localizedFeedback(feedback: StrategyFeedback, locale: UiLocale): StrategyFeedback {
  if (locale === 'en') return feedback
  const equity = `${(feedback.estimatedEquity * 100).toFixed(1)}%`
  const threshold = feedback.potOdds === null ? null : `${(feedback.potOdds * 100).toFixed(1)}%`
  const recommendation = feedback.recommendation
  // 与 en rationaleFor 对齐:recommendationFor 在当前 100BB 配置下只可能返回
  // call / fold / bet / raise / check 五类,不返回 allIn,因此无需覆盖。
  const rationale = recommendation.type === 'call' && threshold !== null
    ? `抽样胜率约为 ${equity}，高于当前 ${threshold} 的底池赔率临界值。这只是价格与估算胜率之间的练习性比较。`
    : recommendation.type === 'fold' && threshold !== null
      ? `抽样胜率约为 ${equity}，没有明显高于跟注临界值，因此这条简化基准线倾向弃牌。`
      : recommendation.type === 'fold'
        ? `当前需要跟注的筹码超过了可用筹码；这条简化基准线不把它当成普通的底池赔率跟注，倾向弃牌。`
      : recommendation.type === 'bet' || recommendation.type === 'raise'
        ? `当前没有需要跟注的下注；抽样胜率约为 ${equity}。这条简化基准线允许一次小额价值下注。`
        : `当前没有需要跟注的下注；抽样胜率约为 ${equity}。这条简化基准线保留过牌的选择。`
  // 直接按 chips 构造,避免 `describeActionText(...,1).replace(' BB',' chips')` 这类脆弱字符串替换。
  const recommendationText = recommendation.type === 'bet' || recommendation.type === 'raise'
    ? `${actionText(recommendation, locale)} to ${recommendation.amount ?? 0} chips`
    : actionText(recommendation, locale)
  return {
    ...feedback,
    recommendationText,
    rationale,
    analysis: {
      ...feedback.analysis,
      assumptions: feedback.analysis.assumptions.map(localizedAssumption)
    },
    assumptions: feedback.assumptions.map(localizedAssumption),
    source: '在你的设备上根据这手牌估算得出。'
  }
}
