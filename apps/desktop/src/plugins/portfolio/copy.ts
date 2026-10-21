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
    missingBacktest:
      'Pentru backtesting, Brain instalează o singură dată serviciul de date cu NautilusTrader, separat de Hermes (circa 500 MB, câteva minute).',
    stoppedBacktest: 'Serviciul de date e oprit. Pornește-l ca să rulezi un backtest.',
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
      prepare: 'Pregătește cererea'
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
  team: {
    agent: 'Agent',
    noAgent: 'niciun agent',
    copied: 'Nu am putut scrie cererea în chat. Am copiat-o: lipește-o în conversație.'
  },
  plan: {
    title: 'Planul de investiții',
    subtitle: 'Ce vrei să ai, după ce reguli, și unde vrei să ajungi — față de portofoliul de acum.',
    loading: 'Se încarcă planul…',
    loadFailed: 'Planul nu a putut fi încărcat',
    unsaved: 'Planul nu e salvat încă: valorile de mai jos sunt cele de pornire.',
    updated: (date: string, by: string) => `Actualizat pe ${date} de ${by}.`,
    edit: 'Editează planul',
    save: 'Salvează planul',
    saving: 'Se salvează…',
    saveFailed: 'Planul nu a putut fi salvat.',
    footer: (file: string) =>
      `Planul e salvat în ${file}, lângă jurnal, ca echipa de investiții să-l poată citi și urma.`,
    allocation: {
      title: 'Alocarea țintă',
      subtitle: 'Cât din portofoliu vrei în fiecare clasă, față de cât e acum.',
      none: 'Nu ai fixat încă ținte. Apasă „Editează planul” sau cere echipei să propună un plan.',
      class: 'Clasă',
      target: 'Țintă',
      now: 'Acum',
      drift: 'Abatere',
      action: 'Ca să revii la țintă',
      targetFor: (name: string) => `Ținta pentru ${name}`,
      points: (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')} pp`,
      sell: (amount: string) => `vinde ~${amount}`,
      buy: (amount: string) => `cumpără ~${amount}`,
      onTarget: 'în țintă',
      sum: (total: string) => `Total ținte: ${total} (trebuie să fie 100%).`
    },
    rules: {
      title: 'Reguli',
      pointsUnit: 'pp',
      labels: {
        max_position_pct: 'Poziția cea mai mare',
        rebalance_band_pp: 'Rebalansare la abatere de',
        min_cash_pct: 'Numerar minim',
        review_loss_pct: 'Revizuiește o poziție la pierdere de'
      },
      hints: {
        max_position_pct: 'Nicio poziție nu trece de acest procent din portofoliu.',
        rebalance_band_pp: 'Nicio clasă nu e mai departe de țintă decât atât.',
        min_cash_pct: 'Numerarul nu scade sub acest procent.',
        review_loss_pct: 'Nicio poziție nu a pierdut atât de la cumpărare.'
      },
      kept: 'respectată',
      broken: 'încălcată'
    },
    goals: {
      title: 'Obiective',
      none: 'Niciun obiectiv încă. Adaugă unul din „Editează planul”, de exemplu un avans pentru restaurant.',
      name: 'Numele obiectivului',
      namePlaceholder: 'Obiectiv (ex. Restaurantul nostru)',
      amount: 'Suma țintă',
      by: 'Până la',
      add: 'Adaugă obiectiv',
      remove: (name: string) => `Șterge obiectivul ${name}`,
      reached: 'Atins.',
      progress: (share: string) => `${share} din țintă.`,
      overdue: (share: string) => `${share} din țintă; termenul a trecut.`,
      needed: (share: string, yearly: string) => `${share} din țintă; mai e nevoie de ~${yearly} pe an.`
    },
    thesis: {
      title: 'Strategia',
      none: 'Nicio strategie scrisă încă. Spune în câteva rânduri de ce investești, pe ce orizont și ce nu faci niciodată.',
      placeholder: 'De ce investesc, pe ce orizont, ce risc accept, ce nu fac niciodată… (Markdown)'
    },
    ask: {
      title: 'Cere echipei',
      subtitle: 'Se deschide o conversație nouă cu agentul ales, cu cererea gata scrisă. O citești și apeși Trimite.',
      kind: 'Ce cer',
      kinds: { propose: 'Propune un plan', review: 'Verifică planul' },
      hints: {
        propose: 'Echipa scrie un plan nou în fișierul planului; apare aici după salvare și îl poți edita.',
        review: 'Echipa nu schimbă planul: scrie o verificare, care apare în Research, la rapoarte.'
      },
      noteLabel: 'Ce vrei în mod special',
      notePlaceholder: 'Opțional: de exemplu „vreau mai puțin cripto” sau „economisesc pentru restaurant”.'
    }
  },
  backtest: {
    loadingRun: 'Se încarcă rularea…',
    strategies: {
      sma_cross: {
        name: 'Medii mobile',
        rule: 'Cumpără când media rapidă a prețului trece peste media lentă și vinde când coboară sub ea.'
      },
      rsi_revert: {
        name: 'RSI',
        rule: 'Cumpără când RSI scade sub pragul de jos (activul pare supravândut) și vinde când urcă peste pragul de sus.'
      },
      breakout: {
        name: 'Breakout',
        rule: 'Cumpără când prețul închide peste maximul ultimelor zile și vinde când închide sub minimul ultimelor zile.'
      },
      buy_hold: {
        name: 'Cumpără și păstrează',
        rule: 'Cumpără în prima zi și păstrează până la sfârșit: reperul cu care se compară orice strategie.'
      }
    },
    params: {
      fast: 'Media rapidă (zile)',
      slow: 'Media lentă (zile)',
      period: 'RSI pe (zile)',
      low: 'Prag de jos',
      high: 'Prag de sus',
      entry: 'Intrare: maximul pe (zile)',
      exit: 'Ieșire: minimul pe (zile)'
    },
    settings: {
      title: (symbol: string) => `Testează o strategie pe ${symbol}`,
      subtitle:
        'Pe prețurile zilnice din trecut, cu motorul NautilusTrader. Doar pe creștere: strategia e ori în activ, ori în numerar.',
      strategy: 'Strategia',
      period: 'Perioada',
      years: (count: number) => (count === 1 ? '1 an' : `${count} ani`),
      capital: 'Capital',
      fee: 'Comision %',
      howItWorks:
        'Ordinele se execută la închiderea zilei semnalului, cu comisionul ales. Fiecare rulare se păstrează în dreapta.',
      run: 'Rulează backtestul',
      running: 'Rulează… (câteva secunde)'
    },
    figures: {
      total: 'Randament total',
      cagr: 'Pe an',
      drawdown: 'Scădere maximă',
      sharpe: 'Sharpe',
      trades: 'Tranzacții',
      winRate: 'Câștigătoare',
      best: 'Cea mai bună',
      worst: (value: string) => `cea mai slabă ${value}`,
      exposure: 'Timp în piață',
      vs: (value: string) => `cumpără și păstrează: ${value}`
    },
    result: {
      view: 'Ce arată graficul',
      views: { equity: 'Valoare', price: 'Preț și tranzacții' },
      span: (from: string, to: string) => `${from} – ${to}`,
      money: (capital: number, currency: string, fee: number) =>
        `${capital.toLocaleString('ro-RO')} ${currency}, comision ${String(fee).replace('.', ',')}%`,
      footer:
        'Rezultatele din trecut nu garantează rezultate viitoare. Simulare pe date zilnice yfinance: fără alunecări de preț, dividende sau taxe.'
    },
    chart: { strategy: 'Strategia', benchmark: 'Cumpără și păstrează', buy: 'C', sell: 'V' },
    trades: {
      none: 'Strategia nu a făcut nicio tranzacție în această perioadă.',
      entry: 'Intrare',
      exit: 'Ieșire',
      open: 'încă deschisă',
      prices: 'Preț',
      result: 'Rezultat'
    },
    runs: {
      title: 'Rulările tale',
      none: 'Nicio rulare încă. Alege un activ și o strategie, apoi apasă „Rulează backtestul”.',
      meta: (years: number, date: string) => `${years === 1 ? '1 an' : `${years} ani`} · ${date}`,
      vs: (value: string) => `reper ${value}`,
      delete: (symbol: string) => `Șterge rularea pentru ${symbol}`,
      deleteTitle: (name: string) => `Ștergi rularea „${name}”?`,
      deleteDescription: 'Rezultatul dispare din listă. O poți rula oricând din nou.',
      deleteConfirm: 'Șterge rularea'
    },
    ask: {
      title: 'Cere echipei să interpreteze rezultatul',
      subtitle: 'Robust sau noroc? Ce merită testat mai departe? Analiza apare în Research, la rapoarte.',
      noteLabel: 'Întrebarea ta',
      notePlaceholder: 'Opțional: de exemplu „aș folosi asta pentru partea de cripto din plan?”'
    },
    errors: {
      invalid: 'Simbolul sau strategia nu au putut fi citite.',
      noData: (symbol: string) => `Sursa de date nu are prețuri pentru ${symbol}.`,
      tooLittle: (symbol: string) => `Pentru ${symbol} există prea puțin istoric în perioada aleasă.`,
      restart: 'Serviciul de date pornit e dintr-o versiune mai veche. Repornește aplicația, apoi rulează din nou.',
      stoppedEarly: 'Motorul s-a oprit înainte de sfârșitul perioadei; rezultatul nu e complet, așa că nu îl arăt.',
      generic: 'Backtestul nu a reușit.'
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
