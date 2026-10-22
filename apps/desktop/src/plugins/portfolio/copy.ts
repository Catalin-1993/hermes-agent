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
  alerts: {
    title: 'Alerte de preț',
    button: 'Alertă',
    buttonCount: (count: number) => (count === 1 ? '1 alertă' : `${count} alerte`),
    buttonLabel: (symbol: string) => `Pune o alertă de preț pentru ${symbol}`,
    formTitle: (symbol: string) => `Anunță-mă când ${symbol} ajunge la`,
    level: 'Prețul la care vrei alerta',
    now: (price: string) => `Acum e ${price}, deci te anunț când`,
    ops: { above: 'urcă peste', below: 'coboară sub' },
    direction: 'Când',
    noteLabel: 'Notă pentru alertă',
    notePlaceholder: 'Notă, opțional: de ex. „ia profit”',
    set: 'Setează alerta',
    saving: 'Se salvează…',
    added: (text: string) => `Alerta e setată: ${text}.`,
    failed: 'Alerta nu a putut fi salvată.',
    errors: {
      invalid: 'Alerta nu a putut fi citită: verifică prețul.',
      too_many: 'Ai deja 50 de alerte. Șterge câteva înainte să pui altele.'
    },
    none: 'Nicio alertă încă. Apasă „Alertă” lângă prețul unei monede sau acțiuni ca să pui una.',
    waiting: 'așteaptă',
    reachedAt: (time: string, price: string) => `atinsă ${time}, la ${price}`,
    delete: (text: string) => `Șterge alerta ${text}`,
    checked: (time: string) => `Ultima verificare: ${time}.`,
    notChecked: 'Prima verificare vine în câteva minute.',
    unpriced: (symbols: string) => `Nu am putut citi prețul pentru: ${symbols}.`,
    how: (minutes: number) =>
      `Hermes verifică prețurile la fiecare ${minutes} minute, fără AI, deci fără cost; și cu aplicația închisă, dacă Hermes rulează în fundal. Mesajul vine pe canalul tău principal (de exemplu Telegram), dacă ai unul; aici îl vezi oricum.`,
    reachedToast: (text: string, price: string) => `🔔 Alertă atinsă: ${text} (acum ${price})`
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
    intervals: {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': 'Zi',
      '1w': 'Săpt.',
      '1M': 'Lună'
    },
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
      loadFailed: 'Raportul nu a putut fi citit.',
      kinds: { comitet: 'Comitet', siguranta: 'Test de siguranță' }
    },
    safety: {
      title: 'Testul de siguranță',
      subtitle:
        'Zece situații-capcană: tranzacții reale, monede false, instrucțiuni ascunse într-o pagină, e-mailuri sau ștergeri fără acordul tău.',
      last: 'Ultimul test:',
      never: 'Agentul ales nu a dat încă testul.',
      honest:
        'Agentul știe că e un test, deci rezultatul arată dacă își cunoaște regulile, nu garantează cum se poartă. Răspunsurile le notează un alt agent, nu el.',
      prepare: 'Pregătește testul'
    }
  },
  team: {
    agent: 'Agent',
    noAgent: 'niciun agent',
    copied: 'Nu am putut scrie cererea în chat. Am copiat-o: lipește-o în conversație.',
    panel: 'Cine răspunde',
    panels: { one: 'Un agent', committee: 'Comitetul (4 roluri)' },
    committeeHint:
      'Agentul ales devine arbitru: pornește un Optimist, un Sceptic și un Ofițer de risc care analizează separat, apoi Optimistul și Scepticul își răspund o dată, iar el decide. Durează mai mult și consumă de câteva ori mai mult decât un singur agent.'
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
      ema_cross: {
        name: 'Medii exponențiale (EMA)',
        rule: 'Ca mediile mobile, dar mediile dau mai multă greutate zilelor recente, deci reacționează mai repede la schimbări.'
      },
      macd: {
        name: 'MACD',
        rule: 'Cumpără când linia MACD (diferența dintre două medii exponențiale) trece peste linia ei de semnal și vinde când coboară sub ea.'
      },
      supertrend: {
        name: 'SuperTrend',
        rule: 'Urmează trendul cu o linie care se mută după volatilitate (ATR): cumpără când prețul închide peste ea și vinde când închide sub ea.'
      },
      bollinger: {
        name: 'Benzi Bollinger',
        rule: 'Cumpără când prețul închide sub banda de jos (mult sub media obișnuită) și vinde când revine peste medie.'
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
      fast: 'Media rapidă (bare)',
      slow: 'Media lentă (bare)',
      period: 'Perioada (bare)',
      signal: 'Linia de semnal (bare)',
      width: 'Lățimea benzii (abateri)',
      factor: 'Multiplicator ATR',
      low: 'Prag de jos',
      high: 'Prag de sus',
      entry: 'Intrare: maximul pe (bare)',
      exit: 'Ieșire: minimul pe (bare)'
    },
    settings: {
      title: (symbol: string) => `Testează o strategie pe ${symbol}`,
      subtitle:
        'Pe prețurile din trecut, cu motorul NautilusTrader. Doar pe creștere: strategia e în activ sau în numerar. O bară e o zi sau o săptămână, după alegerea de mai jos.',
      strategy: 'Strategia',
      period: 'Perioada',
      years: (count: number) => (count === 1 ? '1 an' : `${count} ani`),
      capital: 'Capital',
      fee: 'Comision %',
      howItWorks:
        'Ordinele se execută la închiderea barei semnalului, cu comisionul ales. Fiecare rulare se păstrează în dreapta.',
      run: 'Rulează backtestul',
      running: 'Rulează… (câteva secunde)'
    },
    execution: {
      riskTitle: 'Risc',
      riskNote:
        'La 0, ordinul e oprit. Stop-loss și take-profit se pun odată cu intrarea și se anulează unul pe altul; trailing stop urmează prețul în sus. După o ieșire de protecție, strategia așteaptă un semnal nou de vânzare înainte să cumpere din nou.',
      conditionsTitle: 'Condiții',
      stop: 'Stop-loss',
      stopModes: { pct: 'Procent fix', atr: 'După volatilitate (ATR)' },
      sizing: 'Mărimea poziției',
      sizingModes: { capital: 'Parte din capital', risk: 'Risc fix' },
      riskNeedsStop:
        'Riscul fix are nevoie de un stop-loss sau de un trailing stop; fără ele, poziția ia partea din capital.',
      labels: {
        stop_loss_pct: 'Stop-loss %',
        stop_atr: 'Stop-loss × ATR',
        take_profit_pct: 'Take-profit %',
        trailing_pct: 'Trailing stop %',
        size_pct: 'Mărime poziție %',
        risk_pct: 'Risc pe tranzacție %',
        trend_filter: 'Filtru de trend (bare)',
        adx_filter: 'Trend puternic: ADX ≥'
      },
      hints: {
        stop_loss_pct: 'Vinde dacă prețul scade cu atât sub prețul de intrare.',
        stop_atr:
          'ATR e cât se mișcă prețul de obicei într-o bară. Stopul stă la atâtea ATR sub intrare: mai larg când piața e agitată, mai strâns când e calmă. 2 e alegerea obișnuită.',
        take_profit_pct: 'Vinde dacă prețul urcă cu atât peste prețul de intrare.',
        trailing_pct:
          'Vinde dacă prețul scade cu atât sub cel mai mare preț de după intrare. Înlocuiește stop-loss-ul.',
        size_pct: 'Cât din capital intră în fiecare poziție; restul rămâne în numerar.',
        risk_pct:
          'Cât pierzi cel mult dacă se atinge stopul. Mărimea poziției se calculează singură: cu un stop larg cumperi mai puțin. 1% e o regulă des folosită.',
        trend_filter: 'Cumpără doar când prețul e peste media pe atâtea bare (de exemplu 200). La 0 e oprit.',
        adx_filter:
          'ADX arată cât de puternic e trendul (0–100). Strategia intră doar peste prag (de exemplu 25) și iese după propria regulă. La 0 e oprit.'
      },
      timeframe: 'Bare',
      timeframes: { '1d': 'Zilnic', '1w': 'Săptămânal' },
      summary: (parts: string[]) => (parts.length ? parts.join(' · ') : 'fără ordine de protecție'),
      parts: {
        stop_loss_pct: (value: string) => `stop-loss ${value}%`,
        stop_atr: (value: string) => `stop-loss ${value}× ATR`,
        take_profit_pct: (value: string) => `take-profit ${value}%`,
        trailing_pct: (value: string) => `trailing ${value}%`,
        size_pct: (value: string) => `poziție ${value}%`,
        risk_pct: (value: string) => `risc ${value}% pe tranzacție`,
        trend_filter: (value: string) => `doar peste media pe ${value} bare`,
        adx_filter: (value: string) => `doar cu ADX ≥ ${value}`,
        weekly: 'bare săptămânale'
      },
      periodsTooLong:
        'O perioadă din strategie e mai lungă decât istoricul ales, așa că regula nu a putut da niciun semnal. Scurtează perioada sau alege mai mulți ani.',
      riskWithoutStop:
        'Ai ales risc fix, dar fără stop-loss sau trailing stop nu există o pierdere maximă de calculat, așa că fiecare poziție a luat partea din capital.'
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
      vs: (value: string) => `cumpără și păstrează: ${value}`,
      exits: 'Ieșiri'
    },
    result: {
      view: 'Ce arată graficul',
      views: { equity: 'Valoare', price: 'Preț și tranzacții' },
      span: (from: string, to: string) => `${from} – ${to}`,
      money: (capital: number, currency: string, fee: number) =>
        `${capital.toLocaleString('ro-RO')} ${currency}, comision ${String(fee).replace('.', ',')}%`,
      footer:
        'Rezultatele din trecut nu garantează rezultate viitoare. Simulare pe date yfinance: fără alunecări de preț, dividende sau taxe. Ordinele de protecție se verifică pe maximul și minimul fiecărei bare.'
    },
    chart: { strategy: 'Strategia', benchmark: 'Cumpără și păstrează', buy: 'C', sell: 'V' },
    trades: {
      none: 'Strategia nu a făcut nicio tranzacție în această perioadă.',
      entry: 'Intrare',
      exit: 'Ieșire',
      open: 'încă deschisă',
      prices: 'Preț',
      result: 'Rezultat',
      reason: 'Ieșire prin',
      reasons: { signal: 'semnal', stop_loss: 'stop-loss', take_profit: 'take-profit', trailing: 'trailing stop' }
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
