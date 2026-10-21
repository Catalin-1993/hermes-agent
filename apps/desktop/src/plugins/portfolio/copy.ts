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
    value: 'Valoare',
    sinceStart: (date: string) => `de la ${date}`,
    ofPortfolio: (share: string) => `${share} din portofoliu`,
    historyTitle: 'Valoarea portofoliului',
    historySubtitle: 'Închiderea zilnică, în euro',
    historyWaiting: 'Graficul apare după a doua zi de tranzacționare cu prețuri de piață.',
    allocationTitle: 'Alocare pe clase',
    unverified: (count: number) =>
      count === 1
        ? '1 tranzacție fără verdictul ofițerului de risc.'
        : `${count} tranzacții fără verdictul ofițerului de risc.`,
    footer: (dir: string) =>
      `Simulare — nu este consultanță financiară autorizată. Date: yfinance prin OpenBB. Jurnal: ${dir}.`
  },
  positions: {
    title: 'Poziții',
    asset: 'Activ',
    class: 'Clasă',
    price: 'Preț',
    value: 'Valoare',
    weight: 'Pondere',
    return: 'Randament',
    journalPrice: 'jurnal',
    journalPriceTip: 'Piața nu are un preț pentru acest activ; se folosește costul din jurnal.'
  }
} as const
