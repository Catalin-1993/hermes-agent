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
    missingResearch:
      'Pentru fișa activului, Brain instalează o singură dată serviciul de date OpenBB, separat de Hermes (circa 400 MB, 1–2 minute). Cererea către echipă merge și fără el.',
    stoppedResearch: 'Serviciul de date e oprit. Pornește-l ca să vezi fișa activului.',
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
  research: {
    pickTitle: 'Alege un activ',
    pickHint: 'Scrie un simbol sus (de exemplu BTC sau AAPL) sau adaugă monede și acțiuni în Watchlist.',
    loadingSheet: 'Se încarcă fișa…',
    sheetFailed: 'Fișa nu a putut fi încărcată',
    picker: {
      label: 'Simbolul de analizat',
      placeholder: 'Simbol (ex. BTC, AAPL, VWCE.DE)',
      kind: 'Tipul activului',
      open: 'Deschide fișa'
    },
    sheet: {
      crypto: 'Criptomonedă',
      stock: 'Acțiune',
      fund: 'ETF / fond',
      closeOf: (date: string) => `închiderea din ${date}`,
      periods: { '1w': '1 săptămână', '1m': '1 lună', '3m': '3 luni', '1y': '1 an' },
      high52: 'Maxim 52 săpt.',
      low52: 'Minim 52 săpt.',
      fromHigh: 'Față de maxim',
      rsi: 'RSI (14 zile)',
      overbought: 'supracumpărat',
      oversold: 'supravândut',
      neutral: 'neutru',
      sma50: 'Media 50 de zile',
      sma200: 'Media 200 de zile',
      volatility: 'Volatilitate anuală',
      drawdown: 'Scădere maximă (1 an)',
      trend: (above: boolean, golden: boolean | null) =>
        `Prețul e ${above ? 'peste' : 'sub'} media de 200 de zile${
          golden === null
            ? ''
            : golden
              ? ', iar media de 50 e peste cea de 200 (trend de creștere).'
              : ', iar media de 50 e sub cea de 200 (trend de scădere).'
        }${golden === null ? '.' : ''}`,
      noHistory: 'Nu există încă istoric de prețuri pentru acest activ.',
      noPrices: (error: string) => `Sursa de date nu are prețuri pentru acest simbol (${error}).`,
      noProfile: 'Profilul companiei nu e disponibil acum.',
      restart: 'Serviciul de date pornit e dintr-o versiune mai veche. Repornește aplicația ca să vezi profilul.',
      more: 'Mai mult',
      less: 'Mai puțin',
      metrics: {
        market_cap: 'Capitalizare',
        total_assets: 'Active administrate',
        pe_ratio: 'P/E',
        forward_pe: 'P/E estimat',
        peg_ratio: 'PEG',
        price_to_book: 'Preț / valoare contabilă',
        enterprise_to_ebitda: 'EV / EBITDA',
        dividend_yield: 'Randament dividend',
        expense_ratio: 'Cost anual (TER)',
        profit_margin: 'Marjă de profit',
        return_on_equity: 'Rentabilitate (ROE)',
        revenue_growth: 'Creșterea vânzărilor',
        earnings_growth: 'Creșterea profitului',
        debt_to_equity: 'Datorii / capital',
        beta: 'Beta',
        fund_family: 'Emitent',
        category: 'Categorie'
      }
    },
    ask: {
      title: (symbol: string) => `Cere echipei o analiză pentru ${symbol}`,
      subtitle: 'Se deschide o conversație nouă cu agentul ales, cu cererea gata scrisă. O citești și apeși Trimite.',
      agent: 'Agent',
      noAgent: 'niciun agent',
      kind: 'Tipul analizei',
      kinds: { full: 'Completă', quick: 'Rapidă', risk: 'Risc' },
      kindHint: {
        full: 'Fundamente, tehnic, știri, riscuri, trei scenarii și un verdict.',
        quick: 'Câteva puncte: ce s-a întâmplat, unde e prețul, riscul principal, verdict.',
        risk: 'Ce poate merge rău, cât să cântărească în portofoliu, când teza nu mai e valabilă.'
      },
      noteLabel: 'Întrebarea ta',
      notePlaceholder: 'Opțional: ce vrei să afli în mod special?',
      howItWorks: (agent: string) => `Raportul apare în dreapta când ${agent} îl salvează.`,
      prepare: 'Pregătește cererea',
      copied: 'Nu am putut scrie cererea în chat. Am copiat-o: lipește-o în conversație.'
    },
    reports: {
      title: 'Rapoartele echipei',
      only: (symbol: string) => (symbol ? `Doar ${symbol}` : 'Filtrează'),
      none: 'Niciun raport încă. Cere o analiză echipei; raportul apare aici după ce agentul îl salvează.',
      noneForSymbol: (symbol: string) => `Niciun raport pentru ${symbol} încă.`,
      folder: (dir: string) => `Dosar: ${dir}`,
      back: 'Înapoi la fișă',
      loading: 'Se încarcă raportul…',
      loadFailed: 'Raportul nu a putut fi citit.'
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
