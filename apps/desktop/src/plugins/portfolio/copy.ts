/** The Portfolio page's words — Romanian, the owner's language for this feature. */
export const COPY = {
  nav: 'Portofoliu',
  openPage: 'Portofoliu: deschide',
  sections: {
    backtest: 'Backtesting',
    dashboard: 'Dashboard',
    plan: 'Plan',
    research: 'Research',
    watchlist: 'Watchlist'
  },
  comingSoon: (stage: number) => `Vine în etapa ${stage} a construcției.`,
  prices: { jurnal: 'prețuri din jurnal', mixt: 'prețuri de piață și din jurnal', piață: 'prețuri de piață' },
  marketData: {
    title: 'Prețuri de piață',
    missing:
      'Pentru prețuri reale, Brain instalează o singură dată serviciul de date OpenBB, separat de Hermes (circa 400 MB, 1–2 minute). Până atunci valorile sunt cele din jurnal.',
    missingWatchlist:
      'Pentru prețurile acțiunilor și ETF-urilor, Brain instalează o singură dată serviciul de date OpenBB, separat de Hermes (circa 400 MB, 1–2 minute).',
    stoppedWatchlist: 'Serviciul de date e oprit. Pornește-l ca să vezi prețurile acțiunilor.',
    installing: 'Se instalează serviciul de date… durează 1–2 minute. Poți folosi aplicația între timp.',
    starting: 'Pornește serviciul de date…',
    stopped: 'Serviciul de date e oprit. Valorile de mai jos sunt din jurnal.',
    outdated: 'După ultimul update, serviciul de date are nevoie de o actualizare.',
    failed: 'Instalarea nu a reușit.',
    startFailed: 'Serviciul de date nu a pornit.',
    install: 'Instalează',
    start: 'Pornește',
    update: 'Actualizează'
  },
  dashboard: {
    title: 'Portofoliul simulat',
    subtitle: (variant: string, started: string, prices: string, asOf: null | string) =>
      `Varianta ${variant} · pornit pe ${started} · ${prices}${asOf ? ` la ${asOf}` : ''}`,
    variant: 'Varianta',
    variantName: (name: string) => `Varianta ${name}`,
    loading: 'Se încarcă portofoliul…',
    loadFailed: 'Portofoliul nu a putut fi încărcat',
    noJournal: 'Portofoliul simulat nu a fost pornit încă',
    noJournalHint: (dir: string) =>
      `Cere echipei de investiții: „Porniți portofoliul simulat”. Jurnalul va apărea în ${dir}.`,
    total: 'Valoare totală',
    pnl: 'Câștig total',
    today: 'Azi',
    cash: 'Numerar',
    invested: 'Investit',
    fees: 'Comisioane',
    feesHint: 'plătite până acum',
    positionsCount: (count: number) => (count === 1 ? '1 poziție' : `${count} poziții`),
    value: 'Valoare',
    sinceStart: (date: string) => `de la ${date}`,
    ofPortfolio: (share: string) => `${share} din portofoliu`,
    historyWaiting: 'Graficul apare după a doua zi de tranzacționare cu prețuri de piață.',
    allocationTitle: 'Alocare pe clase',
    unverified: (count: number) =>
      count === 1
        ? '1 tranzacție fără verdictul ofițerului de risc.'
        : `${count} tranzacții fără verdictul ofițerului de risc.`,
    footer: (dir: string) =>
      `Simulare — nu este consultanță financiară autorizată. Date: yfinance prin OpenBB. Jurnal: ${dir}.`
  },
  chart: {
    title: 'Valoarea portofoliului',
    lineNote: 'Închiderea zilnică, în euro',
    candlesNote: 'Lumânări zilnice, în euro',
    mode: 'Tipul graficului',
    line: 'Linie',
    candles: 'Lumânări',
    candlesMissing: 'Lumânările apar după ce serviciul de date pornește din nou, cu datele zilnice complete.',
    range: 'Perioada',
    ranges: { '1m': '1L', '1w': '1S', '3m': '3L', all: 'Tot' },
    open: 'Deschidere',
    high: 'Maxim',
    low: 'Minim',
    close: 'Închidere'
  },
  watchlist: {
    loading: 'Se încarcă listele…',
    loadFailed: 'Listele nu au putut fi încărcate',
    empty: 'Lista e goală',
    emptyHint: {
      crypto: 'Adaugă o monedă din dreapta, de exemplu BTC.',
      stocks: 'Adaugă o acțiune sau un ETF din dreapta, de exemplu AAPL sau VWCE.DE.'
    },
    addLabel: 'Simbolul de adăugat',
    addPlaceholder: 'Adaugă monedă (ex. SOL)',
    addStockPlaceholder: 'Adaugă simbol (ex. AAPL)',
    add: 'Adaugă',
    already: (symbol: string) => `${symbol} e deja în listă.`,
    unknown: (symbol: string) => `Binance nu are ${symbol} cotat în USDT.`,
    unknownStock: (symbol: string) =>
      `Nu am găsit ${symbol}. Folosește simbolul de pe Yahoo Finance, cu bursa la final (ex. VWCE.DE, TLV.RO).`,
    needsService: 'Pentru acțiuni e nevoie de serviciul de date. Pornește-l din Dashboard, apoi încearcă din nou.',
    remove: (symbol: string) => `Scoate ${symbol} din listă`,
    day: 'în 24 de ore',
    sincePrevious: 'față de închiderea anterioară',
    high: 'Maxim 24h',
    low: 'Minim 24h',
    volume: 'Volum 24h',
    dayHigh: 'Maximul zilei',
    dayLow: 'Minimul zilei',
    dayVolume: 'Volumul zilei',
    shares: (amount: string) => `${amount} titluri`,
    interval: 'Intervalul lumânării',
    loadingChart: 'Se încarcă graficul…',
    noBars: 'Nu există date pentru acest interval.',
    barsFailed: 'Sursa de date nu a răspuns. Verifică conexiunea la internet și încearcă din nou în câteva clipe.',
    restart: 'Serviciul de date pornit e dintr-o versiune mai veche. Repornește aplicația ca să vezi graficul.',
    status: {
      live: 'în direct',
      polled: 'actualizat la un minut',
      connecting: 'se conectează…',
      offline: 'fără conexiune',
      retry: 'Reîncearcă'
    }
  },
  lists: {
    new: 'Listă nouă',
    newTitle: 'Listă nouă',
    nameLabel: 'Numele listei',
    namePlaceholder: 'Nume (ex. Tech SUA, Dividende)',
    defaultName: (index: number) => `Lista mea ${index}`,
    kindLabel: 'Ce conține lista',
    kinds: { crypto: 'Criptomonede', stocks: 'Acțiuni și ETF-uri' },
    kindHint: {
      crypto: 'Prețuri în timp real de la Binance, în USDT.',
      stocks: 'Prețuri prin serviciul de date (Yahoo Finance), în moneda bursei, actualizate la un minut.'
    },
    create: 'Creează lista',
    cancel: 'Renunță',
    manage: 'Opțiunile listei',
    rename: 'Redenumește',
    delete: 'Șterge lista',
    deleteTitle: (name: string) => `Ștergi lista „${name}”?`,
    deleteDescription: (name: string, count: number) =>
      `${count === 1 ? '1 simbol' : `${count} simboluri`} din „${name}” dispar din Watchlist. Portofoliul simulat nu se schimbă.`,
    deleteConfirm: 'Șterge lista',
    emptyList: 'Niciun simbol încă. Adaugă primul mai jos.',
    footer: {
      crypto: 'Prețuri în USDT de la Binance, în timp real. Nu sunt prețurile din portofoliul simulat.',
      stocks:
        'Prețuri Yahoo Finance prin OpenBB, cu întârzierea bursei, în moneda ei. Nu sunt prețurile din portofoliul simulat.'
    }
  },
  highlights: {
    title: 'Pe scurt',
    best: 'Cel mai bun de la cumpărare',
    worst: 'Cel mai slab de la cumpărare',
    today: 'Cel mai bun azi',
    largest: 'Cea mai mare poziție'
  },
  positions: {
    title: 'Poziții',
    asset: 'Activ',
    today: 'Azi',
    price: 'Preț',
    value: 'Valoare',
    weight: 'Pondere',
    return: 'De la cumpărare',
    journalPrice: 'jurnal',
    journalPriceTip: 'Piața nu are un preț pentru acest activ; se folosește costul din jurnal.'
  }
} as const
