/**
 * The Team-mode strings (Inbox, Agents, Org chart, agent file, Rules, Watchdog, ready-made
 * teams) for every locale; `i18n.ts` spreads each into its locale bundle.
 */

// A type, not an interface: locale bundles need the implicit index signature.
export type TeamMessages = {
  inbox: {
    title: string
    subtitle: (n: number) => string
    all: string
    kinds: { question: string; budget: string; review: string; blocked: string; watch: string; problem: string }
    badge: { question: string; budget: string; review: string; blocked: string; watch: string; problem: string }
    answerLabel: string
    answerPlaceholder: string
    answer: string
    approve: string
    requestChanges: string
    changesPlaceholder: string
    sendBack: string
    unblock: string
    open: string
    later: string
    budgetBody: (spend: string, budget: string) => string
    problemBody: (n: number) => string
    raiseBudget: string
    save: string
    cancel: string
    noSummary: string
    emptyTitle: string
    emptyBody: string
    done: { answered: string; approved: string; sentBack: string; unblocked: string; budget: string }
  }
  agents: {
    everyoneWorking: string
    everyoneWorkingHint: string
    boardPaused: string
    boardPausedHint: string
    pauseAll: string
    resumeAll: string
    stopAll: string
    stopAllTitle: string
    stopBody: (n: number) => string
    stopTitle: (name: string) => string
    stop: string
    pause: string
    resume: string
    status: { working: string; idle: string; paused: string; budget: string; boardPaused: string }
    ofBudget: (spend: string, budget: string) => string
    noLimit: (spend: string) => string
    noStore: string
    setBudget: string
    editBudget: string
    raiseBudget: string
    removeBudget: string
    budgetLabel: string
    budgetHint: string
    unpriced: (n: number) => string
    runs14: string
    spendTitle: string
    spendTotal: (spend: string, budget: string) => string
    spendNoBudgets: (spend: string) => string
    stopped: (n: number) => string
    pausedToast: (name: string) => string
    resumedToast: (name: string) => string
    bannerText: string
    bannerResume: string
    empty: string
  }
  org: {
    subtitle: (n: number) => string
    topZone: string
    looseTitle: string
    looseHint: string
    noTitle: string
    runs: (n: number) => string
    moved: (name: string, boss: string) => string
    movedTop: (name: string) => string
    empty: string
  }
  file: {
    titleLabel: string
    titlePlaceholder: string
    reportsTo: string
    nobody: string
    directReports: string
    skills: (n: number) => string
    tabs: { overview: string; work: string; schedule: string; instructions: string }
    successRate: string
    runsWindow: (days: number) => string
    typicalRun: string
    spentMonth: string
    activity14: string
    about: string
    aboutPlaceholder: string
    tools: string
    standardTools: string
    openCards: string
    noOpenCards: string
    history: string
    noRuns: string
    running: string
    noSchedule: string
    nextRun: (when: string) => string
    off: string
    instructionsHint: string
    save: string
    undo: string
    saved: string
    loadFailed: string
  }
  rules: {
    intro: string
    holding: (n: number) => string
    openInbox: string
    quickStart: string
    presets: {
      trades: string
      everything: string
      priority: string
      verifier: string
    }
    add: string
    edit: string
    delete: string
    deleteTitle: (name: string) => string
    deleteBody: string
    empty: string
    finishedBy: string
    anyone: string
    mentions: string
    anyCard: string
    priorityAtLeast: (n: number) => string
    checkedBy: string
    you: string
    name: string
    agentsHint: string
    keywords: string
    keywordsHint: string
    minPriority: string
    anyPriority: string
    checker: string
    agent: string
    pickVerifier: string
    save: string
    cancel: string
    saved: string
    deleted: string
    toggle: string
    heldBy: (name: string) => string
  }
  watch: {
    title: string
    allClear: string
    count: (n: number) => string
    kinds: {
      stalled: string
      slow: string
      failing: string
      waiting: string
      unclaimed: string
      budget_pace: string
    }
    detail: {
      stalled: (value: string) => string
      slow: (value: string) => string
      failing: (value: string) => string
      waiting: (value: string) => string
      unclaimed: (value: string) => string
      budget_pace: (value: string) => string
    }
    restart: string
    nudge: string
    open: string
    openAgent: string
    restarted: string
    nudged: string
  }
  teams: {
    add: string
    title: string
    intro: string
    names: {
      investing: string
      restaurant: string
      research: string
      personal: string
    }
    blurbs: {
      investing: string
      restaurant: string
      research: string
      personal: string
    }
    members: string
    rules: string
    exists: string
    perMonth: (usd: string) => string
    clones: string
    install: (n: number) => string
    addRules: string
    installing: string
    installed: (n: number) => string
    nothingNew: string
    emptyCta: string
  }
  goals: {
    intro: string
    add: string
    edit: string
    title: string
    titlePlaceholder: string
    why: string
    whyPlaceholder: string
    owner: string
    ownerHint: string
    noOwner: string
    target: string
    status: { active: string; achieved: string; dropped: string }
    progress: (done: number, total: number) => string
    dueIn: (days: number) => string
    dueToday: string
    overdue: (days: number) => string
    counts: { done: string; running: string; blocked: string; open: string }
    plan: (name: string) => string
    planned: (name: string) => string
    addCards: string
    addCardsTitle: string
    search: string
    link: (n: number) => string
    noCards: string
    unlink: string
    save: string
    cancel: string
    saved: string
    delete: string
    deleteTitle: (name: string) => string
    deleteBody: string
    deleted: string
    markAchieved: string
    reopen: string
    empty: string
    strip: string
  }
  rhythm: {
    tab: string
    intro: string
    enabled: string
    every: string
    hours: string
    daily: string
    to: string
    allDay: string
    weekdays: string
    next: (when: string) => string
    last: (when: string) => string
    off: string
    perDay: (n: number) => string
    checkIn: string
    checkedIn: string
    saved: string
    chip: (every: string) => string
  }
}

export const TEAM_EN: TeamMessages = {
  inbox: {
    title: 'Inbox',
    subtitle: (n: number) =>
      n === 0
        ? 'Nothing is waiting for you.'
        : n === 1
          ? '1 decision is waiting for you'
          : `${n} decisions are waiting for you`,
    all: 'All',
    kinds: { question: 'Questions', budget: 'Budget', review: 'Reviews', blocked: 'Blocked', watch: 'Watchdog', problem: 'Problems' },
    badge: { question: 'Question', budget: 'Budget reached', review: 'Review', blocked: 'Blocked', watch: 'Watchdog', problem: 'Problem' },
    answerLabel: 'Your answer',
    answerPlaceholder: 'Answer the agent; it picks the task up again with your reply.',
    answer: 'Answer & resume',
    approve: 'Approve',
    requestChanges: 'Request changes',
    changesPlaceholder: 'What should change? The agent gets it as a comment.',
    sendBack: 'Send back',
    unblock: 'Unblock',
    open: 'Open',
    later: 'Later (hide for a day)',
    budgetBody: (spend: string, budget: string) =>
      `Spent ${spend} of its ${budget} monthly budget. It picks up no new cards until you raise the limit or the month ends.`,
    problemBody: (n: number) =>
      n === 1
        ? '1 problem on this task. Open it to see what went wrong and the suggested fix.'
        : `${n} problems on this task. Open it to see what went wrong and the suggested fixes.`,
    raiseBudget: 'Raise budget',
    save: 'Save',
    cancel: 'Cancel',
    noSummary: 'No details from the agent.',
    emptyTitle: 'You’re all caught up',
    emptyBody: 'Questions, reviews and blocked work from your agents land here.',
    done: {
      answered: 'Answer sent; the task is back in Ready.',
      approved: 'Approved and moved to Done.',
      sentBack: 'Sent back with your comment.',
      unblocked: 'Unblocked; the task is back in Ready.',
      budget: 'Budget updated.'
    }
  },
  agents: {
    everyoneWorking: 'Everyone can pick up work',
    everyoneWorkingHint: 'Agents take cards from Ready as soon as they are free.',
    boardPaused: 'Board paused',
    boardPausedHint: 'No agent picks up new cards. Work already running continues unless you stop it.',
    pauseAll: 'Pause everyone',
    resumeAll: 'Resume everyone',
    stopAll: 'Stop everything now',
    stopAllTitle: 'Stop everything that is running?',
    stopBody: (n: number) =>
      `${n === 1 ? '1 running task goes' : `${n} running tasks go`} back to Ready. Pause first if you don’t want them picked up again.`,
    stopTitle: (name: string) => `Stop what ${name} is doing?`,
    stop: 'Stop now',
    pause: 'Pause',
    resume: 'Resume',
    status: { working: 'Working', idle: 'Idle', paused: 'Paused', budget: 'Over budget', boardPaused: 'Board paused' },
    ofBudget: (spend: string, budget: string) => `${spend} of ${budget}`,
    noLimit: (spend: string) => `${spend} · no limit`,
    noStore: 'No spend yet',
    setBudget: 'Set budget',
    editBudget: 'Edit budget',
    raiseBudget: 'Raise budget to resume',
    removeBudget: 'Remove limit',
    budgetLabel: 'Monthly budget (USD)',
    budgetHint:
      'When it is reached, the agent stops picking up cards until the month ends or you raise it. Chats you start yourself are not blocked.',
    unpriced: (n: number) => (n === 1 ? '1 conversation without a price' : `${n} conversations without a price`),
    runs14: 'Finished runs · 14 days',
    spendTitle: 'Spend this month',
    spendTotal: (spend: string, budget: string) => `${spend} of ${budget} budgeted`,
    spendNoBudgets: (spend: string) => `${spend} · no budgets set`,
    stopped: (n: number) => (n === 1 ? '1 task stopped and back in Ready.' : `${n} tasks stopped and back in Ready.`),
    pausedToast: (name: string) => `${name} paused.`,
    resumedToast: (name: string) => `${name} can work again.`,
    bannerText: 'This board is paused: no agent picks up new cards.',
    bannerResume: 'Resume',
    empty: 'No agents yet. Create one in Bot Mode, then assign it a card.'
  },
  org: {
    subtitle: n => `${n} agents · drag a card onto another to change who it reports to`,
    topZone: 'Drop here to put it at the top',
    looseTitle: 'Not placed yet',
    looseHint: 'Drag one onto a manager, or open it to pick one.',
    noTitle: 'No title',
    runs: n => `${n} runs · 14d`,
    moved: (name, boss) => `${name} now reports to ${boss}`,
    movedTop: name => `${name} is now at the top`,
    empty: 'No agents yet. Create a profile and it shows up here.'
  },
  file: {
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. Head of research',
    reportsTo: 'Reports to',
    nobody: 'Nobody (top of the team)',
    directReports: 'Direct reports',
    skills: n => `${n} skills`,
    tabs: { overview: 'Overview', work: 'Work', schedule: 'Schedule', instructions: 'Instructions' },
    successRate: 'Success rate',
    runsWindow: days => `Runs · ${days} days`,
    typicalRun: 'Typical run',
    spentMonth: 'Spent this month',
    activity14: 'Finished runs · last 14 days',
    about: 'What it does',
    aboutPlaceholder: 'One or two sentences: the work this agent should get.',
    tools: 'Tools',
    standardTools: 'Hermes standard set',
    openCards: 'Open cards',
    noOpenCards: 'Nothing open on this board.',
    history: 'Recent runs',
    noRuns: 'No runs on this board yet.',
    running: 'Running',
    noSchedule: 'Nothing scheduled for this agent.',
    nextRun: when => `next ${when}`,
    off: 'Off',
    instructionsHint: 'Its standing instructions (SOUL.md). Changes apply from its next conversation.',
    save: 'Save',
    undo: 'Undo changes',
    saved: 'Saved',
    loadFailed: 'Could not load this agent’s file.'
  },
  rules: {
    intro: 'Rules decide which finished work is checked before it counts as done: by you, or by an agent you trust.',
    holding: n => (n === 1 ? '1 finished card waits for your approval' : `${n} finished cards wait for your approval`),
    openInbox: 'Open Inbox',
    quickStart: 'Quick start',
    presets: {
      trades: 'Buy or sell decisions need my approval',
      everything: 'All finished work needs my approval',
      priority: 'High-priority work needs my approval',
      verifier: 'An agent checks another agent’s work'
    },
    add: 'New rule',
    edit: 'Edit rule',
    delete: 'Delete',
    deleteTitle: name => `Delete “${name}”?`,
    deleteBody: 'Finished work it covers goes straight to Done again. Cards it already holds stay in Review.',
    empty: 'No rules yet: finished work goes straight to Done.',
    finishedBy: 'Finished by',
    anyone: 'Any agent',
    mentions: 'Mentions',
    anyCard: 'Any card',
    priorityAtLeast: n => `Priority ${n}+`,
    checkedBy: 'Checked by',
    you: 'You',
    name: 'Name',
    agentsHint: 'Pick none for any agent.',
    keywords: 'Mentions any of these words',
    keywordsHint: 'Separate with commas; leave empty for any card.',
    minPriority: 'Priority at least',
    anyPriority: 'Any',
    checker: 'Who checks',
    agent: 'An agent',
    pickVerifier: 'Choose the agent',
    save: 'Save rule',
    cancel: 'Cancel',
    saved: 'Rule saved',
    deleted: 'Rule deleted',
    toggle: 'Rule on',
    heldBy: name => `Held by rule: ${name}`
  },
  watch: {
    title: 'Watchdog',
    allClear: 'All clear: nothing looks stuck.',
    count: n => (n === 1 ? '1 thing looks stuck' : `${n} things look stuck`),
    kinds: {
      stalled: 'No sign of life',
      slow: 'Taking unusually long',
      failing: 'Keeps failing',
      waiting: 'Untouched for a day',
      unclaimed: 'Nobody picked it up',
      budget_pace: 'Spending fast'
    },
    detail: {
      stalled: value => `The worker has not checked in for ${value} min.`,
      slow: value => `${value}× longer than this agent’s usual run.`,
      failing: value => `${value} attempts in a row failed.`,
      waiting: value => `Nothing has happened to it for ${value} h.`,
      unclaimed: value => `Ready for ${value} h and no agent took it. Is its agent paused or over budget?`,
      budget_pace: value => `At this pace it spends about ${value} this month, over its budget.`
    },
    restart: 'Restart',
    nudge: 'Wake the dispatcher',
    open: 'Open',
    openAgent: 'Open agent',
    restarted: 'Sent back to Ready',
    nudged: 'Dispatcher woken'
  },
  teams: {
    add: 'Add a ready-made team',
    title: 'Ready-made teams',
    intro: 'A whole team in one step: agents with titles and a reporting line, their instructions, and the rules and budgets that suit them.',
    names: {
      investing: 'Investment team',
      restaurant: 'Restaurant launch',
      research: 'Research desk',
      personal: 'Personal assistants'
    },
    blurbs: {
      investing: 'A lead, a market analyst, a researcher and a risk officer. Buy or sell ideas wait for you; the risk officer checks every analysis.',
      restaurant: 'Plan the opening of a restaurant or café: menu and food costs, marketing, budget and permits. Spending waits for you.',
      research: 'Questions become briefs: a lead, a researcher, a writer, and a fact-checker who checks every brief.',
      personal: 'A chief of staff, a planner and a learning coach. Messages and emails wait for you before they go out.'
    },
    members: 'Members',
    rules: 'Rules it adds to this board',
    exists: 'yours already, kept',
    perMonth: usd => `${usd}/mo`,
    clones: 'New agents start with your current model, keys and skills, never with your messaging bots.',
    install: n => (n === 1 ? 'Create 1 agent' : `Create ${n} agents`),
    addRules: 'Add the rules to this board',
    installing: 'Creating…',
    installed: n => (n === 1 ? 'Team ready: 1 new agent' : `Team ready: ${n} new agents`),
    nothingNew: 'Everything was already there',
    emptyCta: 'Start with a ready-made team'
  },
  goals: {
    intro: 'Goals say what the work is for. Every card linked to a goal, and every card created from it, counts toward its progress, and agents see the goal their card serves.',
    add: 'New goal',
    edit: 'Edit goal',
    title: 'Goal',
    titlePlaceholder: 'e.g. Bring the portfolio back to the plan',
    why: 'Why it matters',
    whyPlaceholder: 'One or two sentences: what changes when this is done.',
    owner: 'Owner',
    ownerHint: 'The agent who plans it and keeps it moving.',
    noOwner: 'No owner',
    target: 'Target date',
    status: { active: 'Active', achieved: 'Achieved', dropped: 'Dropped' },
    progress: (done, total) => `${done} of ${total} cards done`,
    dueIn: days => (days === 1 ? 'due tomorrow' : `due in ${days} days`),
    dueToday: 'due today',
    overdue: days => (days === 1 ? '1 day late' : `${days} days late`),
    counts: { done: 'done', running: 'working', blocked: 'blocked', open: 'to do' },
    plan: name => `Plan with ${name}`,
    planned: name => `${name} has a planning card`,
    addCards: 'Add cards',
    addCardsTitle: 'Add cards to this goal',
    search: 'Search cards',
    link: n => (n === 1 ? 'Add 1 card' : `Add ${n} cards`),
    noCards: 'No cards yet. Plan it with its owner, or add cards from the board.',
    unlink: 'Remove from goal',
    save: 'Save goal',
    cancel: 'Cancel',
    saved: 'Goal saved',
    delete: 'Delete',
    deleteTitle: name => `Delete “${name}”?`,
    deleteBody: 'Its cards stay on the board; they just stop counting toward it.',
    deleted: 'Goal deleted',
    markAchieved: 'Mark achieved',
    reopen: 'Reopen',
    empty: 'No goals yet. Start with what this board is for.',
    strip: 'Goals'
  },
  rhythm: {
    tab: 'Rhythm',
    intro: 'A regular check-in: the agent looks at its open cards and the goals it owns and does the next useful thing, without you starting it.',
    enabled: 'Check in regularly',
    every: 'Every',
    hours: 'Active hours',
    daily: 'day',
    to: 'to',
    allDay: 'All day',
    weekdays: 'Weekdays only',
    next: when => `Next check-in ${when}`,
    last: when => `Last check-in ${when}`,
    off: 'Off: the agent works only when a card comes for it.',
    perDay: n => `About ${n} check-ins a day. Each is one paid run of this agent, within its budget.`,
    checkIn: 'Check in now',
    checkedIn: 'Check-in card added',
    saved: 'Rhythm saved',
    chip: every => `Check-in every ${every}`
  }
}

export const TEAM_JA: TeamMessages = {
  inbox: {
    title: '受信箱',
    subtitle: (n: number) => (n === 0 ? '対応待ちはありません。' : `${n} 件の判断があなたを待っています`),
    all: 'すべて',
    kinds: { question: '質問', budget: '予算', review: 'レビュー', blocked: 'ブロック', watch: 'ウォッチドッグ', problem: '問題' },
    badge: { question: '質問', budget: '予算到達', review: 'レビュー', blocked: 'ブロック', watch: 'ウォッチドッグ', problem: '問題' },
    answerLabel: 'あなたの回答',
    answerPlaceholder: 'エージェントに回答すると、その内容でタスクを再開します。',
    answer: '回答して再開',
    approve: '承認',
    requestChanges: '修正を依頼',
    changesPlaceholder: '何を変えるべきですか?コメントとしてエージェントに届きます。',
    sendBack: '差し戻す',
    unblock: 'ブロック解除',
    open: '開く',
    later: 'あとで(1日非表示)',
    budgetBody: (spend: string, budget: string) =>
      `月間予算 ${budget} のうち ${spend} を使用しました。上限を上げるか月が変わるまで新しいカードを取りません。`,
    problemBody: (n: number) => `このタスクに問題が ${n} 件あります。開いて原因と修正案を確認してください。`,
    raiseBudget: '予算を上げる',
    save: '保存',
    cancel: 'キャンセル',
    noSummary: 'エージェントからの詳細はありません。',
    emptyTitle: 'すべて対応済みです',
    emptyBody: 'エージェントからの質問、レビュー、ブロックされた作業がここに届きます。',
    done: {
      answered: '回答を送信しました。タスクは Ready に戻りました。',
      approved: '承認して Done に移動しました。',
      sentBack: 'コメントを付けて差し戻しました。',
      unblocked: 'ブロックを解除しました。タスクは Ready に戻りました。',
      budget: '予算を更新しました。'
    }
  },
  agents: {
    everyoneWorking: '全員が作業を受け取れます',
    everyoneWorkingHint: 'エージェントは空き次第 Ready からカードを取ります。',
    boardPaused: 'ボード一時停止中',
    boardPausedHint: '新しいカードを取るエージェントはいません。実行中の作業は停止しない限り続きます。',
    pauseAll: '全員を一時停止',
    resumeAll: '全員を再開',
    stopAll: '今すぐすべて停止',
    stopAllTitle: '実行中のすべてを停止しますか?',
    stopBody: (n: number) =>
      `実行中のタスク ${n} 件が Ready に戻ります。再度取られたくない場合は先に一時停止してください。`,
    stopTitle: (name: string) => `${name} の作業を停止しますか?`,
    stop: '今すぐ停止',
    pause: '一時停止',
    resume: '再開',
    status: { working: '作業中', idle: '待機中', paused: '一時停止', budget: '予算超過', boardPaused: 'ボード停止中' },
    ofBudget: (spend: string, budget: string) => `${spend} / ${budget}`,
    noLimit: (spend: string) => `${spend} · 上限なし`,
    noStore: 'まだ支出なし',
    setBudget: '予算を設定',
    editBudget: '予算を編集',
    raiseBudget: '予算を上げて再開',
    removeBudget: '上限を削除',
    budgetLabel: '月間予算 (USD)',
    budgetHint: '上限に達すると、月が変わるか上限を上げるまでカードを取りません。自分で始めたチャットは止まりません。',
    unpriced: (n: number) => `価格のない会話 ${n} 件`,
    runs14: '完了した実行 · 14日間',
    spendTitle: '今月の支出',
    spendTotal: (spend: string, budget: string) => `予算 ${budget} のうち ${spend}`,
    spendNoBudgets: (spend: string) => `${spend} · 予算未設定`,
    stopped: (n: number) => `${n} 件のタスクを停止し Ready に戻しました。`,
    pausedToast: (name: string) => `${name} を一時停止しました。`,
    resumedToast: (name: string) => `${name} は再び作業できます。`,
    bannerText: 'このボードは一時停止中です。新しいカードを取るエージェントはいません。',
    bannerResume: '再開',
    empty: 'まだエージェントがいません。Bot モードで作成し、カードを割り当ててください。'
  },
  org: {
    subtitle: n => `${n} エージェント · カードを別のカードにドラッグして上司を変更`,
    topZone: 'ここにドロップしてトップに置く',
    looseTitle: '未配置',
    looseHint: '上司のカードにドラッグするか、開いて選択します。',
    noTitle: '役職なし',
    runs: n => `${n} 回 · 14日`,
    moved: (name, boss) => `${name} は ${boss} の配下になりました`,
    movedTop: name => `${name} をトップに置きました`,
    empty: 'エージェントはまだいません。プロファイルを作成するとここに表示されます。'
  },
  file: {
    titleLabel: '役職',
    titlePlaceholder: '例: リサーチ責任者',
    reportsTo: '上司',
    nobody: 'なし(チームのトップ)',
    directReports: '直属の部下',
    skills: n => `${n} スキル`,
    tabs: { overview: '概要', work: '作業', schedule: 'スケジュール', instructions: '指示' },
    successRate: '成功率',
    runsWindow: days => `実行 · ${days} 日`,
    typicalRun: '標準的な実行時間',
    spentMonth: '今月の支出',
    activity14: '完了した実行 · 過去14日',
    about: '担当内容',
    aboutPlaceholder: 'このエージェントに任せる仕事を1〜2文で。',
    tools: 'ツール',
    standardTools: 'Hermes 標準セット',
    openCards: '未完了のカード',
    noOpenCards: 'このボードに未完了のカードはありません。',
    history: '最近の実行',
    noRuns: 'このボードでの実行はまだありません。',
    running: '実行中',
    noSchedule: 'このエージェントの予定はありません。',
    nextRun: when => `次回 ${when}`,
    off: 'オフ',
    instructionsHint: '常設の指示 (SOUL.md)。変更は次の会話から適用されます。',
    save: '保存',
    undo: '変更を取り消す',
    saved: '保存しました',
    loadFailed: 'このエージェントの情報を読み込めませんでした。'
  },
  rules: {
    intro: '完了した作業を「完了」にする前に誰が確認するかを決めます。あなた自身か、信頼するエージェントです。',
    holding: n => `${n} 件の完了カードがあなたの承認待ちです`,
    openInbox: '受信箱を開く',
    quickStart: 'クイックスタート',
    presets: {
      trades: '売買の判断は私の承認が必要',
      everything: 'すべての完了作業に私の承認が必要',
      priority: '優先度の高い作業は私の承認が必要',
      verifier: '別のエージェントが作業を確認する'
    },
    add: '新しいルール',
    edit: 'ルールを編集',
    delete: '削除',
    deleteTitle: name => `「${name}」を削除しますか?`,
    deleteBody: '対象の完了作業は再びそのまま「完了」になります。すでに保留中のカードはレビューに残ります。',
    empty: 'ルールはまだありません。完了した作業はそのまま「完了」になります。',
    finishedBy: '完了者',
    anyone: 'すべてのエージェント',
    mentions: '含む語',
    anyCard: 'すべてのカード',
    priorityAtLeast: n => `優先度 ${n} 以上`,
    checkedBy: '確認者',
    you: 'あなた',
    name: '名前',
    agentsHint: '選ばなければすべてのエージェントが対象です。',
    keywords: 'いずれかの語を含む',
    keywordsHint: 'カンマ区切り。空欄ならすべてのカード。',
    minPriority: '最低優先度',
    anyPriority: '指定なし',
    checker: '確認する人',
    agent: 'エージェント',
    pickVerifier: 'エージェントを選択',
    save: 'ルールを保存',
    cancel: 'キャンセル',
    saved: 'ルールを保存しました',
    deleted: 'ルールを削除しました',
    toggle: 'ルール有効',
    heldBy: name => `ルールにより保留: ${name}`
  },
  watch: {
    title: 'ウォッチドッグ',
    allClear: '問題なし: 止まっている作業はありません。',
    count: n => `${n} 件が止まっているようです`,
    kinds: {
      stalled: '応答なし',
      slow: '異常に長い',
      failing: '失敗が続く',
      waiting: '1日動きなし',
      unclaimed: '誰も着手していない',
      budget_pace: '支出が速い'
    },
    detail: {
      stalled: value => `ワーカーが ${value} 分間応答していません。`,
      slow: value => `このエージェントの通常の ${value} 倍の時間がかかっています。`,
      failing: value => `${value} 回連続で失敗しました。`,
      waiting: value => `${value} 時間何も起きていません。`,
      unclaimed: value => `${value} 時間 Ready のままです。エージェントが一時停止中か予算超過では?`,
      budget_pace: value => `このペースだと今月約 ${value} を使い、予算を超えます。`
    },
    restart: '再開',
    nudge: 'ディスパッチャーを起こす',
    open: '開く',
    openAgent: 'エージェントを開く',
    restarted: 'Ready に戻しました',
    nudged: 'ディスパッチャーを起こしました'
  },
  teams: {
    add: '既成チームを追加',
    title: '既成チーム',
    intro: '役職と指揮系統、指示、適したルールと予算を備えたチームを一度に作成します。',
    names: {
      investing: '投資チーム',
      restaurant: 'レストラン開業',
      research: 'リサーチデスク',
      personal: 'パーソナルアシスタント'
    },
    blurbs: {
      investing: 'リーダー、市場アナリスト、リサーチャー、リスク担当。売買の提案はあなたの承認待ちになり、分析はすべてリスク担当が確認します。',
      restaurant: 'レストランやカフェの開業計画: メニューと原価、マーケティング、予算と許認可。支出はあなたの承認待ちです。',
      research: '質問をブリーフに: リーダー、リサーチャー、ライター、そしてすべてのブリーフを確認するファクトチェッカー。',
      personal: '首席補佐官、プランナー、学習コーチ。メッセージやメールは送信前にあなたの承認を待ちます。'
    },
    members: 'メンバー',
    rules: 'このボードに追加されるルール',
    exists: '既存のため維持',
    perMonth: usd => `${usd}/月`,
    clones: '新しいエージェントは現在のモデル、キー、スキルを引き継ぎます。メッセージングボットは引き継ぎません。',
    install: n => `${n} 人のエージェントを作成`,
    addRules: 'このボードにルールを追加',
    installing: '作成中…',
    installed: n => `チームの準備完了: 新しいエージェント ${n} 人`,
    nothingNew: 'すべて既に存在していました',
    emptyCta: '既成チームから始める'
  },
  goals: {
    intro: '目標は作業の目的を示します。目標に紐づくカードと、そこから作られたカードはすべて進捗に数えられ、エージェントは自分のカードがどの目標に役立つかを確認できます。',
    add: '新しい目標',
    edit: '目標を編集',
    title: '目標',
    titlePlaceholder: '例: ポートフォリオを計画どおりに戻す',
    why: 'なぜ重要か',
    whyPlaceholder: '1〜2文で: 達成すると何が変わるか。',
    owner: '担当',
    ownerHint: '計画を立てて進める担当エージェント。',
    noOwner: '担当なし',
    target: '目標日',
    status: { active: '進行中', achieved: '達成', dropped: '中止' },
    progress: (done, total) => `${total} 枚中 ${done} 枚完了`,
    dueIn: days => `あと ${days} 日`,
    dueToday: '今日が期限',
    overdue: days => `${days} 日遅れ`,
    counts: { done: '完了', running: '作業中', blocked: 'ブロック', open: '未着手' },
    plan: name => `${name} と計画する`,
    planned: name => `${name} に計画カードがあります`,
    addCards: 'カードを追加',
    addCardsTitle: 'この目標にカードを追加',
    search: 'カードを検索',
    link: n => `${n} 枚追加`,
    noCards: 'カードはまだありません。担当と計画するか、ボードから追加してください。',
    unlink: '目標から外す',
    save: '目標を保存',
    cancel: 'キャンセル',
    saved: '目標を保存しました',
    delete: '削除',
    deleteTitle: name => `「${name}」を削除しますか?`,
    deleteBody: 'カードはボードに残り、進捗に数えられなくなるだけです。',
    deleted: '目標を削除しました',
    markAchieved: '達成にする',
    reopen: '再開',
    empty: '目標はまだありません。このボードの目的から始めましょう。',
    strip: '目標'
  },
  rhythm: {
    tab: 'リズム',
    intro: '定期チェックイン: エージェントが自分の未完了カードと担当目標を確認し、あなたが始めなくても次の有用な作業を行います。',
    enabled: '定期的にチェックイン',
    every: '間隔',
    hours: '稼働時間',
    daily: '1日',
    to: '〜',
    allDay: '終日',
    weekdays: '平日のみ',
    next: when => `次回チェックイン ${when}`,
    last: when => `前回チェックイン ${when}`,
    off: 'オフ: カードが来たときだけ作業します。',
    perDay: n => `1日約 ${n} 回。各回は予算内でのこのエージェントの有料実行です。`,
    checkIn: '今すぐチェックイン',
    checkedIn: 'チェックインカードを追加しました',
    saved: 'リズムを保存しました',
    chip: every => `${every} ごとにチェックイン`
  }
}

export const TEAM_ZH: TeamMessages = {
  inbox: {
    title: '收件箱',
    subtitle: (n: number) => (n === 0 ? '没有等待你的事项。' : `${n} 项决定在等你`),
    all: '全部',
    kinds: { question: '问题', budget: '预算', review: '审核', blocked: '阻塞', watch: '看门狗', problem: '故障' },
    badge: { question: '问题', budget: '预算已用完', review: '审核', blocked: '阻塞', watch: '看门狗', problem: '故障' },
    answerLabel: '你的回答',
    answerPlaceholder: '回答智能体;它会带着你的回复重新开始任务。',
    answer: '回答并继续',
    approve: '批准',
    requestChanges: '要求修改',
    changesPlaceholder: '需要改什么?智能体会以评论形式收到。',
    sendBack: '退回',
    unblock: '解除阻塞',
    open: '打开',
    later: '稍后(隐藏一天)',
    budgetBody: (spend: string, budget: string) =>
      `已用 ${spend},月预算 ${budget}。在你提高上限或本月结束前,它不会领取新卡片。`,
    problemBody: (n: number) => `此任务有 ${n} 个故障。打开查看原因和建议的修复。`,
    raiseBudget: '提高预算',
    save: '保存',
    cancel: '取消',
    noSummary: '智能体没有提供详情。',
    emptyTitle: '全部处理完了',
    emptyBody: '智能体的问题、审核和被阻塞的工作都会出现在这里。',
    done: {
      answered: '回答已发送;任务回到 Ready。',
      approved: '已批准并移到 Done。',
      sentBack: '已附评论退回。',
      unblocked: '已解除阻塞;任务回到 Ready。',
      budget: '预算已更新。'
    }
  },
  agents: {
    everyoneWorking: '所有人都可以领取工作',
    everyoneWorkingHint: '智能体一有空就从 Ready 领取卡片。',
    boardPaused: '看板已暂停',
    boardPausedHint: '没有智能体领取新卡片。正在运行的工作会继续,除非你停止它。',
    pauseAll: '暂停所有人',
    resumeAll: '恢复所有人',
    stopAll: '立即停止全部',
    stopAllTitle: '停止所有正在运行的工作?',
    stopBody: (n: number) => `${n} 个运行中的任务会回到 Ready。如果不想被再次领取,请先暂停。`,
    stopTitle: (name: string) => `停止 ${name} 正在做的事?`,
    stop: '立即停止',
    pause: '暂停',
    resume: '恢复',
    status: { working: '工作中', idle: '空闲', paused: '已暂停', budget: '超出预算', boardPaused: '看板已暂停' },
    ofBudget: (spend: string, budget: string) => `${spend} / ${budget}`,
    noLimit: (spend: string) => `${spend} · 无上限`,
    noStore: '暂无花费',
    setBudget: '设置预算',
    editBudget: '编辑预算',
    raiseBudget: '提高预算以恢复',
    removeBudget: '取消上限',
    budgetLabel: '月预算(美元)',
    budgetHint: '达到后,在本月结束或你提高上限前,智能体不再领取卡片。你自己发起的对话不受限制。',
    unpriced: (n: number) => `${n} 个对话没有价格`,
    runs14: '已完成的运行 · 14 天',
    spendTitle: '本月花费',
    spendTotal: (spend: string, budget: string) => `${spend} / 预算 ${budget}`,
    spendNoBudgets: (spend: string) => `${spend} · 未设预算`,
    stopped: (n: number) => `已停止 ${n} 个任务并回到 Ready。`,
    pausedToast: (name: string) => `已暂停 ${name}。`,
    resumedToast: (name: string) => `${name} 可以继续工作了。`,
    bannerText: '此看板已暂停:没有智能体领取新卡片。',
    bannerResume: '恢复',
    empty: '还没有智能体。在 Bot 模式中创建一个,再分配卡片。'
  },
  org: {
    subtitle: n => `${n} 个智能体 · 将卡片拖到另一张卡片上即可更改其上级`,
    topZone: '拖到这里放在最顶层',
    looseTitle: '尚未安排',
    looseHint: '拖到某位上级上，或打开后选择。',
    noTitle: '无职位',
    runs: n => `${n} 次运行 · 14天`,
    moved: (name, boss) => `${name} 现在向 ${boss} 汇报`,
    movedTop: name => `${name} 现在位于最顶层`,
    empty: '还没有智能体。创建一个配置档后会显示在这里。'
  },
  file: {
    titleLabel: '职位',
    titlePlaceholder: '例如：研究负责人',
    reportsTo: '汇报给',
    nobody: '无（团队最顶层）',
    directReports: '直接下属',
    skills: n => `${n} 个技能`,
    tabs: { overview: '概览', work: '工作', schedule: '计划', instructions: '指令' },
    successRate: '成功率',
    runsWindow: days => `运行 · ${days} 天`,
    typicalRun: '典型运行时长',
    spentMonth: '本月花费',
    activity14: '已完成的运行 · 最近14天',
    about: '负责内容',
    aboutPlaceholder: '用一两句话说明该交给这个智能体的工作。',
    tools: '工具',
    standardTools: 'Hermes 标准工具集',
    openCards: '未完成的卡片',
    noOpenCards: '此看板上没有未完成的卡片。',
    history: '最近的运行',
    noRuns: '此看板上还没有运行记录。',
    running: '运行中',
    noSchedule: '此智能体没有计划任务。',
    nextRun: when => `下次 ${when}`,
    off: '已关闭',
    instructionsHint: '常驻指令 (SOUL.md)。修改从下一次对话开始生效。',
    save: '保存',
    undo: '撤销更改',
    saved: '已保存',
    loadFailed: '无法加载此智能体的档案。'
  },
  rules: {
    intro: '规则决定哪些已完成的工作在计为完成之前需要检查：由你检查，或由你信任的智能体检查。',
    holding: n => `${n} 张已完成的卡片等待你的批准`,
    openInbox: '打开收件箱',
    quickStart: '快速开始',
    presets: {
      trades: '买卖决定需要我批准',
      everything: '所有完成的工作都需要我批准',
      priority: '高优先级工作需要我批准',
      verifier: '由一个智能体检查另一个智能体的工作'
    },
    add: '新规则',
    edit: '编辑规则',
    delete: '删除',
    deleteTitle: name => `删除“${name}”？`,
    deleteBody: '它覆盖的完成工作将重新直接进入已完成。已被它暂留的卡片仍留在审核中。',
    empty: '还没有规则：完成的工作直接进入已完成。',
    finishedBy: '完成者',
    anyone: '任何智能体',
    mentions: '提到',
    anyCard: '任何卡片',
    priorityAtLeast: n => `优先级 ${n}+`,
    checkedBy: '检查者',
    you: '你',
    name: '名称',
    agentsHint: '不选则适用于任何智能体。',
    keywords: '提到以下任一词语',
    keywordsHint: '用逗号分隔；留空则适用于任何卡片。',
    minPriority: '最低优先级',
    anyPriority: '任意',
    checker: '由谁检查',
    agent: '一个智能体',
    pickVerifier: '选择智能体',
    save: '保存规则',
    cancel: '取消',
    saved: '规则已保存',
    deleted: '规则已删除',
    toggle: '启用规则',
    heldBy: name => `被规则暂留：${name}`
  },
  watch: {
    title: '看门狗',
    allClear: '一切正常：没有卡住的工作。',
    count: n => `${n} 项看起来卡住了`,
    kinds: {
      stalled: '没有动静',
      slow: '耗时异常',
      failing: '反复失败',
      waiting: '一天无变化',
      unclaimed: '无人领取',
      budget_pace: '花费过快'
    },
    detail: {
      stalled: value => `工作进程已 ${value} 分钟没有回报。`,
      slow: value => `耗时是该智能体通常的 ${value} 倍。`,
      failing: value => `连续 ${value} 次尝试失败。`,
      waiting: value => `已 ${value} 小时没有任何变化。`,
      unclaimed: value => `已就绪 ${value} 小时无人领取。它的智能体是否已暂停或超出预算？`,
      budget_pace: value => `按这个速度本月将花费约 ${value}，超出预算。`
    },
    restart: '重新开始',
    nudge: '唤醒调度器',
    open: '打开',
    openAgent: '打开智能体',
    restarted: '已退回就绪',
    nudged: '已唤醒调度器'
  },
  teams: {
    add: '添加现成团队',
    title: '现成团队',
    intro: '一步建好整个团队：带职位和汇报关系的智能体、它们的指令，以及合适的规则和预算。',
    names: {
      investing: '投资团队',
      restaurant: '餐厅开业',
      research: '研究台',
      personal: '个人助理'
    },
    blurbs: {
      investing: '一位负责人、一位市场分析师、一位研究员和一位风控官。买卖建议等你批准；每份分析都由风控官检查。',
      restaurant: '规划餐厅或咖啡馆开业：菜单与食材成本、营销、预算与许可。支出等你批准。',
      research: '把问题变成简报：负责人、研究员、写作者，以及检查每份简报的事实核查员。',
      personal: '一位幕僚长、一位规划师和一位学习教练。消息和邮件在发出前等你批准。'
    },
    members: '成员',
    rules: '添加到此看板的规则',
    exists: '已存在，保留',
    perMonth: usd => `${usd}/月`,
    clones: '新智能体沿用你当前的模型、密钥和技能，但不会带上你的消息机器人。',
    install: n => `创建 ${n} 个智能体`,
    addRules: '将规则添加到此看板',
    installing: '正在创建…',
    installed: n => `团队已就绪：新增 ${n} 个智能体`,
    nothingNew: '一切都已存在',
    emptyCta: '从现成团队开始'
  },
  goals: {
    intro: '目标说明工作的目的。关联到目标的每张卡片，以及由它创建的每张卡片，都计入进度；智能体能看到自己的卡片服务于哪个目标。',
    add: '新目标',
    edit: '编辑目标',
    title: '目标',
    titlePlaceholder: '例如：让投资组合回到计划',
    why: '为什么重要',
    whyPlaceholder: '一两句话：完成后会有什么改变。',
    owner: '负责人',
    ownerHint: '负责规划并推进它的智能体。',
    noOwner: '无负责人',
    target: '目标日期',
    status: { active: '进行中', achieved: '已达成', dropped: '已放弃' },
    progress: (done, total) => `${total} 张卡片中已完成 ${done} 张`,
    dueIn: days => `还有 ${days} 天`,
    dueToday: '今天到期',
    overdue: days => `逾期 ${days} 天`,
    counts: { done: '已完成', running: '进行中', blocked: '阻塞', open: '待办' },
    plan: name => `与 ${name} 规划`,
    planned: name => `${name} 有一张规划卡片`,
    addCards: '添加卡片',
    addCardsTitle: '向此目标添加卡片',
    search: '搜索卡片',
    link: n => `添加 ${n} 张卡片`,
    noCards: '还没有卡片。与负责人一起规划，或从看板添加卡片。',
    unlink: '移出目标',
    save: '保存目标',
    cancel: '取消',
    saved: '目标已保存',
    delete: '删除',
    deleteTitle: name => `删除“${name}”？`,
    deleteBody: '它的卡片仍留在看板上，只是不再计入进度。',
    deleted: '目标已删除',
    markAchieved: '标记为已达成',
    reopen: '重新打开',
    empty: '还没有目标。从这个看板的用途开始吧。',
    strip: '目标'
  },
  rhythm: {
    tab: '节奏',
    intro: '定期签到：智能体查看自己的未完成卡片和负责的目标，并做下一件有用的事，无需你来启动。',
    enabled: '定期签到',
    every: '每隔',
    hours: '活跃时段',
    daily: '天',
    to: '至',
    allDay: '全天',
    weekdays: '仅工作日',
    next: when => `下次签到 ${when}`,
    last: when => `上次签到 ${when}`,
    off: '关闭：只有卡片分配给它时才工作。',
    perDay: n => `每天约 ${n} 次签到。每次都是该智能体的一次付费运行，受预算限制。`,
    checkIn: '立即签到',
    checkedIn: '已添加签到卡片',
    saved: '节奏已保存',
    chip: every => `每 ${every} 签到`
  }
}

export const TEAM_ZH_HANT: TeamMessages = {
  inbox: {
    title: '收件匣',
    subtitle: (n: number) => (n === 0 ? '沒有等待你的事項。' : `${n} 項決定在等你`),
    all: '全部',
    kinds: { question: '問題', budget: '預算', review: '審核', blocked: '封鎖', watch: '看門狗', problem: '故障' },
    badge: { question: '問題', budget: '預算已用完', review: '審核', blocked: '封鎖', watch: '看門狗', problem: '故障' },
    answerLabel: '你的回答',
    answerPlaceholder: '回答代理;它會帶著你的回覆重新開始任務。',
    answer: '回答並繼續',
    approve: '核准',
    requestChanges: '要求修改',
    changesPlaceholder: '需要改什麼?代理會以留言形式收到。',
    sendBack: '退回',
    unblock: '解除封鎖',
    open: '開啟',
    later: '稍後(隱藏一天)',
    budgetBody: (spend: string, budget: string) =>
      `已用 ${spend},月預算 ${budget}。在你提高上限或本月結束前,它不會領取新卡片。`,
    problemBody: (n: number) => `此任務有 ${n} 個故障。開啟查看原因與建議的修正。`,
    raiseBudget: '提高預算',
    save: '儲存',
    cancel: '取消',
    noSummary: '代理沒有提供詳情。',
    emptyTitle: '全部處理完了',
    emptyBody: '代理的問題、審核和被封鎖的工作都會出現在這裡。',
    done: {
      answered: '回答已送出;任務回到 Ready。',
      approved: '已核准並移到 Done。',
      sentBack: '已附留言退回。',
      unblocked: '已解除封鎖;任務回到 Ready。',
      budget: '預算已更新。'
    }
  },
  agents: {
    everyoneWorking: '所有人都可以領取工作',
    everyoneWorkingHint: '代理一有空就從 Ready 領取卡片。',
    boardPaused: '看板已暫停',
    boardPausedHint: '沒有代理領取新卡片。正在執行的工作會繼續,除非你停止它。',
    pauseAll: '暫停所有人',
    resumeAll: '恢復所有人',
    stopAll: '立即停止全部',
    stopAllTitle: '停止所有正在執行的工作?',
    stopBody: (n: number) => `${n} 個執行中的任務會回到 Ready。如果不想被再次領取,請先暫停。`,
    stopTitle: (name: string) => `停止 ${name} 正在做的事?`,
    stop: '立即停止',
    pause: '暫停',
    resume: '恢復',
    status: { working: '工作中', idle: '閒置', paused: '已暫停', budget: '超出預算', boardPaused: '看板已暫停' },
    ofBudget: (spend: string, budget: string) => `${spend} / ${budget}`,
    noLimit: (spend: string) => `${spend} · 無上限`,
    noStore: '尚無花費',
    setBudget: '設定預算',
    editBudget: '編輯預算',
    raiseBudget: '提高預算以恢復',
    removeBudget: '取消上限',
    budgetLabel: '月預算(美元)',
    budgetHint: '達到後,在本月結束或你提高上限前,代理不再領取卡片。你自己發起的對話不受限制。',
    unpriced: (n: number) => `${n} 個對話沒有價格`,
    runs14: '已完成的執行 · 14 天',
    spendTitle: '本月花費',
    spendTotal: (spend: string, budget: string) => `${spend} / 預算 ${budget}`,
    spendNoBudgets: (spend: string) => `${spend} · 未設預算`,
    stopped: (n: number) => `已停止 ${n} 個任務並回到 Ready。`,
    pausedToast: (name: string) => `已暫停 ${name}。`,
    resumedToast: (name: string) => `${name} 可以繼續工作了。`,
    bannerText: '此看板已暫停:沒有代理領取新卡片。',
    bannerResume: '恢復',
    empty: '還沒有代理。在 Bot 模式中建立一個,再指派卡片。'
  },
  org: {
    subtitle: n => `${n} 個代理 · 將卡片拖到另一張卡片上即可變更其上級`,
    topZone: '拖到這裡放在最頂層',
    looseTitle: '尚未安排',
    looseHint: '拖到某位上級上，或開啟後選擇。',
    noTitle: '無職位',
    runs: n => `${n} 次執行 · 14天`,
    moved: (name, boss) => `${name} 現在向 ${boss} 匯報`,
    movedTop: name => `${name} 現在位於最頂層`,
    empty: '還沒有代理。建立一個設定檔後會顯示在這裡。'
  },
  file: {
    titleLabel: '職位',
    titlePlaceholder: '例如：研究負責人',
    reportsTo: '匯報給',
    nobody: '無（團隊最頂層）',
    directReports: '直接下屬',
    skills: n => `${n} 個技能`,
    tabs: { overview: '概覽', work: '工作', schedule: '排程', instructions: '指令' },
    successRate: '成功率',
    runsWindow: days => `執行 · ${days} 天`,
    typicalRun: '典型執行時長',
    spentMonth: '本月花費',
    activity14: '已完成的執行 · 最近14天',
    about: '負責內容',
    aboutPlaceholder: '用一兩句話說明該交給這個代理的工作。',
    tools: '工具',
    standardTools: 'Hermes 標準工具集',
    openCards: '未完成的卡片',
    noOpenCards: '此看板上沒有未完成的卡片。',
    history: '最近的執行',
    noRuns: '此看板上還沒有執行紀錄。',
    running: '執行中',
    noSchedule: '此代理沒有排程任務。',
    nextRun: when => `下次 ${when}`,
    off: '已關閉',
    instructionsHint: '常駐指令 (SOUL.md)。修改從下一次對話開始生效。',
    save: '儲存',
    undo: '復原變更',
    saved: '已儲存',
    loadFailed: '無法載入此代理的檔案。'
  },
  rules: {
    intro: '規則決定哪些已完成的工作在計為完成之前需要檢查：由你檢查，或由你信任的代理檢查。',
    holding: n => `${n} 張已完成的卡片等待你的核准`,
    openInbox: '開啟收件匣',
    quickStart: '快速開始',
    presets: {
      trades: '買賣決定需要我核准',
      everything: '所有完成的工作都需要我核准',
      priority: '高優先級工作需要我核准',
      verifier: '由一個代理檢查另一個代理的工作'
    },
    add: '新規則',
    edit: '編輯規則',
    delete: '刪除',
    deleteTitle: name => `刪除「${name}」？`,
    deleteBody: '它涵蓋的完成工作將重新直接進入已完成。已被它暫留的卡片仍留在審核中。',
    empty: '還沒有規則：完成的工作直接進入已完成。',
    finishedBy: '完成者',
    anyone: '任何代理',
    mentions: '提到',
    anyCard: '任何卡片',
    priorityAtLeast: n => `優先級 ${n}+`,
    checkedBy: '檢查者',
    you: '你',
    name: '名稱',
    agentsHint: '不選則適用於任何代理。',
    keywords: '提到以下任一詞語',
    keywordsHint: '以逗號分隔；留空則適用於任何卡片。',
    minPriority: '最低優先級',
    anyPriority: '任意',
    checker: '由誰檢查',
    agent: '一個代理',
    pickVerifier: '選擇代理',
    save: '儲存規則',
    cancel: '取消',
    saved: '規則已儲存',
    deleted: '規則已刪除',
    toggle: '啟用規則',
    heldBy: name => `被規則暫留：${name}`
  },
  watch: {
    title: '看門狗',
    allClear: '一切正常：沒有卡住的工作。',
    count: n => `${n} 項看起來卡住了`,
    kinds: {
      stalled: '沒有動靜',
      slow: '耗時異常',
      failing: '反覆失敗',
      waiting: '一天無變化',
      unclaimed: '無人領取',
      budget_pace: '花費過快'
    },
    detail: {
      stalled: value => `工作程序已 ${value} 分鐘沒有回報。`,
      slow: value => `耗時是該代理通常的 ${value} 倍。`,
      failing: value => `連續 ${value} 次嘗試失敗。`,
      waiting: value => `已 ${value} 小時沒有任何變化。`,
      unclaimed: value => `已就緒 ${value} 小時無人領取。它的代理是否已暫停或超出預算？`,
      budget_pace: value => `照這個速度本月將花費約 ${value}，超出預算。`
    },
    restart: '重新開始',
    nudge: '喚醒排程器',
    open: '開啟',
    openAgent: '開啟代理',
    restarted: '已退回就緒',
    nudged: '已喚醒排程器'
  },
  teams: {
    add: '加入現成團隊',
    title: '現成團隊',
    intro: '一步建好整個團隊：帶職位與匯報關係的代理、它們的指令，以及合適的規則與預算。',
    names: {
      investing: '投資團隊',
      restaurant: '餐廳開業',
      research: '研究台',
      personal: '個人助理'
    },
    blurbs: {
      investing: '一位負責人、一位市場分析師、一位研究員和一位風控官。買賣建議等你核准；每份分析都由風控官檢查。',
      restaurant: '規劃餐廳或咖啡館開業：菜單與食材成本、行銷、預算與許可。支出等你核准。',
      research: '把問題變成簡報：負責人、研究員、寫作者，以及檢查每份簡報的事實查核員。',
      personal: '一位幕僚長、一位規劃師和一位學習教練。訊息和郵件在送出前等你核准。'
    },
    members: '成員',
    rules: '加入此看板的規則',
    exists: '已存在，保留',
    perMonth: usd => `${usd}/月`,
    clones: '新代理沿用你目前的模型、金鑰與技能，但不會帶上你的訊息機器人。',
    install: n => `建立 ${n} 個代理`,
    addRules: '將規則加入此看板',
    installing: '正在建立…',
    installed: n => `團隊已就緒：新增 ${n} 個代理`,
    nothingNew: '一切都已存在',
    emptyCta: '從現成團隊開始'
  },
  goals: {
    intro: '目標說明工作的目的。關聯到目標的每張卡片，以及由它建立的每張卡片，都計入進度；代理能看到自己的卡片服務於哪個目標。',
    add: '新目標',
    edit: '編輯目標',
    title: '目標',
    titlePlaceholder: '例如：讓投資組合回到計畫',
    why: '為什麼重要',
    whyPlaceholder: '一兩句話：完成後會有什麼改變。',
    owner: '負責人',
    ownerHint: '負責規劃並推進它的代理。',
    noOwner: '無負責人',
    target: '目標日期',
    status: { active: '進行中', achieved: '已達成', dropped: '已放棄' },
    progress: (done, total) => `${total} 張卡片中已完成 ${done} 張`,
    dueIn: days => `還有 ${days} 天`,
    dueToday: '今天到期',
    overdue: days => `逾期 ${days} 天`,
    counts: { done: '已完成', running: '進行中', blocked: '封鎖', open: '待辦' },
    plan: name => `與 ${name} 規劃`,
    planned: name => `${name} 有一張規劃卡片`,
    addCards: '加入卡片',
    addCardsTitle: '將卡片加入此目標',
    search: '搜尋卡片',
    link: n => `加入 ${n} 張卡片`,
    noCards: '還沒有卡片。與負責人一起規劃，或從看板加入卡片。',
    unlink: '移出目標',
    save: '儲存目標',
    cancel: '取消',
    saved: '目標已儲存',
    delete: '刪除',
    deleteTitle: name => `刪除「${name}」？`,
    deleteBody: '它的卡片仍留在看板上，只是不再計入進度。',
    deleted: '目標已刪除',
    markAchieved: '標記為已達成',
    reopen: '重新開啟',
    empty: '還沒有目標。從這個看板的用途開始吧。',
    strip: '目標'
  },
  rhythm: {
    tab: '節奏',
    intro: '定期簽到：代理查看自己的未完成卡片與負責的目標，並做下一件有用的事，無需你來啟動。',
    enabled: '定期簽到',
    every: '每隔',
    hours: '活躍時段',
    daily: '天',
    to: '至',
    allDay: '全天',
    weekdays: '僅工作日',
    next: when => `下次簽到 ${when}`,
    last: when => `上次簽到 ${when}`,
    off: '關閉：只有卡片分配給它時才工作。',
    perDay: n => `每天約 ${n} 次簽到。每次都是該代理的一次付費執行，受預算限制。`,
    checkIn: '立即簽到',
    checkedIn: '已加入簽到卡片',
    saved: '節奏已儲存',
    chip: every => `每 ${every} 簽到`
  }
}
