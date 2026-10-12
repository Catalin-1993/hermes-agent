/**
 * Built-in desktop themes. Names match the CLI skins / dashboard presets.
 * Add new themes here — no code changes needed elsewhere.
 *
 * The palette-bearing skins (nous, catppuccin, everforest, solarized) are forks
 * of their VS Code originals, converted by `buildThemeFromMarketplace` (see
 * ./install.ts) from the extensions below — the same path a Marketplace import
 * takes, so each is identical to installing the extension by hand and costs the
 * user neither the download nor the install step.
 *
 *   nous       ← github.github-vscode-theme   (Light Default / Dark Default)
 *   catppuccin ← Catppuccin.catppuccin-vsc    (Latte / Mocha)
 *   everforest ← sainnhe.everforest
 *   solarized  ← ryanolsonx.solarized
 *
 * Re-convert marketplace forks from the upstream extension rather than
 * hand-editing hexes; hand edits drift from upstream silently and can't be
 * re-derived. `nous-alt` is first-party — do not re-derive it from GitHub.
 */

import { THEME_PRESET_PALETTES } from '@hermes/shared'

import type { DesktopTheme, DesktopThemeTypography } from './types'

// Color-emoji fonts to append to every stack as a last resort. None of the UI
// text/mono fonts carry emoji glyphs, so without this emoji render as tofu
// boxes on platforms whose default text font lacks them (e.g. Linux/#40364).
// Covers macOS, Windows, Linux, plus the `emoji` generic for anything else.
export const EMOJI_FALLBACK = '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji'

const SYSTEM_SANS =
  '"Segoe WPC", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif, ' +
  EMOJI_FALLBACK

// Keep the bundled JetBrains Mono first in every mono fallback chain. Several
// theme display fonts (Courier Prime, IBM Plex Mono) do not cover Vietnamese /
// Latin Extended glyphs; falling directly to platform UI fonts makes code
// blocks visibly non-monospace. JetBrains Mono is bundled with the app and
// covers those glyphs, while the Linux fallbacks catch distros without it.
const SYSTEM_MONO =
  '"JetBrains Mono", "Cascadia Code", "Cascadia Mono", "DejaVu Sans Mono", "Liberation Mono", "Noto Sans Mono", ' +
  '"Noto Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace, ' +
  EMOJI_FALLBACK

export const DEFAULT_TYPOGRAPHY: DesktopThemeTypography = { fontSans: SYSTEM_SANS, fontMono: SYSTEM_MONO }

/**
 * Nous — the canonical Hermes desktop identity, forked from the GitHub VS Code
 * theme (github.github-vscode-theme). Light is GitHub Light Default, dark is
 * GitHub Dark Default, both converted through the same path a Marketplace
 * install takes, so the palette here is byte-identical to importing the
 * extension yourself.
 *
 * Typography stays Hermes's own: a VS Code theme carries no font opinion, and
 * these are the stacks every skin has been rendering with.
 */
/**
 * GitHub — the upstream palette, unmodified.
 *
 * `nous` is a fork of this with its own accent, so shipping both keeps the
 * original available on its own terms instead of only existing as the thing
 * nous diverged from. Everything but the accent family is identical between
 * them; separate presets are what let nous's accent move without silently
 * redefining what "GitHub" means.
 */
export const githubTheme: DesktopTheme = {
  name: 'github',
  label: 'GitHub',
  description: 'GitHub Light Default and Dark Default',
  ...THEME_PRESET_PALETTES.github,
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  },
  terminal: {
    foreground: '#1f2328',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f'
  },
  darkTerminal: {
    foreground: '#e6edf3',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff'
  }
}

/** Catppuccin — Latte in light, Mocha in dark (Catppuccin.catppuccin-vsc). */

/**
 * Nous — the canonical Hermes desktop identity: GitHub's chrome carrying Nous
 * blue. Forked from github.github-vscode-theme (Light Default / Dark Default),
 * with only the accent family re-seeded; every neutral is upstream's.
 *
 * Two seeds, one blue. `#0053FD` is the brand color and reads at 5.4:1 on the
 * light sidebar, but only 3.6:1 on the near-black dark one — so dark carries
 * `#4a84fe`, the same hue (263°) lifted to clear AA at 5.9:1. The soft
 * surfaces below are mixed from those seeds in OKLab, which is what keeps a
 * saturated blue from drifting violet on its way to white.
 */
export const nousTheme: DesktopTheme = {
  name: 'nous',
  label: 'Nous',
  description: 'GitHub chrome, Nous blue accent',
  ...THEME_PRESET_PALETTES.nous,
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  },
  terminal: {
    foreground: '#1f2328',
    black: '#24292f',
    red: '#cf222e',
    green: '#116329',
    yellow: '#4d2d00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f'
  },
  darkTerminal: {
    foreground: '#e6edf3',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff'
  }
}

/** Catppuccin — Latte in light, Mocha in dark (Catppuccin.catppuccin-vsc). */
export const catppuccinTheme: DesktopTheme = {
  name: 'catppuccin',
  label: 'Catppuccin',
  description: 'Soothing pastels — Latte and Mocha',
  ...THEME_PRESET_PALETTES.catppuccin,
  terminal: {
    foreground: '#4c4f69',
    cursor: '#dc8a78',
    selectionBackground: '#acb0be',
    black: '#5c5f77',
    red: '#d20f39',
    green: '#40a02b',
    yellow: '#df8e1d',
    blue: '#1e66f5',
    magenta: '#ea76cb',
    cyan: '#179299',
    white: '#acb0be',
    brightBlack: '#6c6f85',
    brightRed: '#de293e',
    brightGreen: '#49af3d',
    brightYellow: '#eea02d',
    brightBlue: '#456eff',
    brightMagenta: '#fe85d8',
    brightCyan: '#2d9fa8',
    brightWhite: '#bcc0cc'
  },
  darkTerminal: {
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    selectionBackground: '#585b70',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#a6adc8',
    brightBlack: '#585b70',
    brightRed: '#f37799',
    brightGreen: '#89d88b',
    brightYellow: '#ebd391',
    brightBlue: '#74a8fc',
    brightMagenta: '#f2aede',
    brightCyan: '#6bd7ca',
    brightWhite: '#bac2de'
  }
}

/** Everforest — warm, low-contrast forest greens (sainnhe.everforest). */
export const everforestTheme: DesktopTheme = {
  name: 'everforest',
  label: 'Everforest',
  description: 'Warm, low-contrast forest greens',
  ...THEME_PRESET_PALETTES.everforest,
  terminal: {
    foreground: '#5c6a72',
    cursor: '#5c6a72',
    black: '#5c6a72',
    red: '#f85552',
    green: '#8da101',
    yellow: '#dfa000',
    blue: '#3a94c5',
    magenta: '#df69ba',
    cyan: '#35a77c',
    white: '#939f91',
    brightBlack: '#5c6a72',
    brightRed: '#f85552',
    brightGreen: '#8da101',
    brightYellow: '#dfa000',
    brightBlue: '#3a94c5',
    brightMagenta: '#df69ba',
    brightCyan: '#35a77c',
    brightWhite: '#f4f0d9'
  },
  darkTerminal: {
    foreground: '#d3c6aa',
    cursor: '#d3c6aa',
    black: '#343f44',
    red: '#e67e80',
    green: '#a7c080',
    yellow: '#dbbc7f',
    blue: '#7fbbb3',
    magenta: '#d699b6',
    cyan: '#83c092',
    white: '#d3c6aa',
    brightBlack: '#859289',
    brightRed: '#e67e80',
    brightGreen: '#a7c080',
    brightYellow: '#dbbc7f',
    brightBlue: '#7fbbb3',
    brightMagenta: '#d699b6',
    brightCyan: '#83c092',
    brightWhite: '#d3c6aa'
  }
}

/** Solarized — Ethan Schoonover's fixed-contrast pair (ryanolsonx.solarized). */
export const solarizedTheme: DesktopTheme = {
  name: 'solarized',
  label: 'Solarized',
  description: 'Fixed-contrast light and dark',
  ...THEME_PRESET_PALETTES.solarized,
  terminal: {
    foreground: '#657b83',
    black: '#657b83',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#657b83',
    brightRed: '#cb4b16',
    brightGreen: '#859900',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#eee8d5'
  },
  darkTerminal: {
    foreground: '#839496',
    cursor: '#ffffff',
    selectionBackground: '#ffffff40',
    black: '#14181d',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#e5e5e5',
    brightBlack: '#676767',
    brightRed: '#dc322f',
    brightGreen: '#859900',
    brightYellow: '#b58900',
    brightBlue: '#268bd2',
    brightMagenta: '#d33682',
    brightCyan: '#2aa198',
    brightWhite: '#e5e5e5'
  }
}

/**
 * Nous Alt — the hand-authored Nous from before the GitHub fork. Light is
 * glass neutrals with brand blue; dark is cream on mission-blue.
 */
export const nousAltTheme: DesktopTheme = {
  name: 'nous-alt',
  label: 'Nous Alt',
  description: 'Glass neutrals, cream on mission-blue',
  ...THEME_PRESET_PALETTES['nous-alt'],
  typography: {
    fontSans: SYSTEM_SANS,
    fontMono: SYSTEM_MONO,
    fontUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap'
  }
}

/**
 * Midnight — deep blue-violet, near-monotone. Dark only: it has no light
 * palette because the whole idea is the dark end of the spectrum.
 */
export const midnightTheme: DesktopTheme = {
  name: 'midnight',
  label: 'Midnight',
  description: 'Deep blue-violet with cool accents',
  ...THEME_PRESET_PALETTES.midnight,
  typography: {
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`,
    fontUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap'
  }
}

export const emberTheme: DesktopTheme = {
  name: 'ember',
  label: 'Ember',
  description: 'Warm crimson and bronze — forge vibes',
  ...THEME_PRESET_PALETTES.ember,
  typography: {
    fontMono: `"IBM Plex Mono", ${SYSTEM_MONO}`,
    fontUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap'
  }
}

/** Clean grayscale. Matches the CLI mono skin and dashboard mono theme. */
export const monoTheme: DesktopTheme = {
  name: 'mono',
  label: 'Mono',
  description: 'Clean grayscale — minimal and focused',
  ...THEME_PRESET_PALETTES.mono
}

/** Neon green on black. Matches the CLI cyberpunk skin and dashboard theme. */
export const cyberpunkTheme: DesktopTheme = {
  name: 'cyberpunk',
  label: 'Cyberpunk',
  description: 'Neon green on black — matrix terminal',
  ...THEME_PRESET_PALETTES.cyberpunk,
  typography: {
    fontMono: `"Courier New", Courier, ${SYSTEM_MONO}`,
    fontSans: `"Courier New", Courier, ${SYSTEM_MONO}`
  }
}

/** Cool slate blue for developers. Matches the CLI slate skin. */
export const slateTheme: DesktopTheme = {
  name: 'slate',
  label: 'Slate',
  description: 'Cool slate blue — focused developer theme',
  ...THEME_PRESET_PALETTES.slate,
  typography: {
    fontMono: `"JetBrains Mono", ${SYSTEM_MONO}`
  }
}

// ── Rail-gradient themes: the reading surface flush and deep, the side rails
//    lit from the top and settling towards the bottom (`sidebarTop/Bottom`).

const PREMIUM_DARK_BASE = {
  destructive: '#ef5f55',
  destructiveForeground: '#ffffff'
}

/** Graphite — Codex-like neutrals: a near-black page beside silver-grey rails. */
export const graphiteTheme: DesktopTheme = {
  name: 'graphite',
  label: 'Graphite',
  description: 'Near-black page, silver rails fading into the dark',
  colors: {
    background: '#f5f5f6',
    foreground: '#1d1d1f',
    card: '#ffffff',
    cardForeground: '#1d1d1f',
    muted: '#f0f0f2',
    mutedForeground: '#6e6e73',
    popover: '#ffffff',
    popoverForeground: '#1d1d1f',
    primary: '#2c2c2e',
    primaryForeground: '#ffffff',
    secondary: '#ececef',
    secondaryForeground: '#1d1d1f',
    accent: '#ececef',
    accentForeground: '#1d1d1f',
    border: '#e3e3e6',
    input: '#e3e3e6',
    ring: '#3a3a3c',
    midground: '#3a3a3c',
    destructive: '#d93025',
    destructiveForeground: '#ffffff',
    sidebarBackground: '#ececee',
    sidebarBorder: '#e0e0e3',
    sidebarTop: '#f8f8fa',
    sidebarBottom: '#cfcfd6',
    userBubble: '#f0f0f2',
    userBubbleBorder: '#e3e3e6'
  },
  darkColors: {
    ...PREMIUM_DARK_BASE,
    background: '#1b1b1d',
    foreground: '#ececee',
    card: '#161617',
    cardForeground: '#ececee',
    muted: '#232325',
    mutedForeground: '#9a9aa0',
    popover: '#232325',
    popoverForeground: '#ececee',
    primary: '#e4e4e8',
    primaryForeground: '#161617',
    secondary: '#2a2a2d',
    secondaryForeground: '#ececee',
    accent: '#2a2a2d',
    accentForeground: '#ececee',
    border: '#2e2e31',
    input: '#2e2e31',
    ring: '#c8c8cd',
    midground: '#c8c8cd',
    sidebarBackground: '#2b2b2e',
    sidebarBorder: '#323235',
    sidebarTop: '#4a4a50',
    sidebarBottom: '#141416',
    userBubble: '#262628',
    userBubbleBorder: '#323235'
  }
}

/** Aurora — the second Codex look: rails from deep teal at the top to ember at the bottom. */
export const auroraTheme: DesktopTheme = {
  name: 'aurora',
  label: 'Aurora',
  description: 'Teal dusk melting into ember, beside a deep page',
  colors: {
    background: '#f7f8f7',
    foreground: '#1b2321',
    card: '#ffffff',
    cardForeground: '#1b2321',
    muted: '#eef3f2',
    mutedForeground: '#5e6b68',
    popover: '#ffffff',
    popoverForeground: '#1b2321',
    primary: '#1c655d',
    primaryForeground: '#ffffff',
    secondary: '#e8efed',
    secondaryForeground: '#1b2321',
    accent: '#e8efed',
    accentForeground: '#1b2321',
    border: '#dfe6e4',
    input: '#dfe6e4',
    ring: '#2a8a7e',
    midground: '#2a8a7e',
    destructive: '#c8402f',
    destructiveForeground: '#ffffff',
    sidebarBackground: '#e6efed',
    sidebarBorder: '#d3e2df',
    sidebarTop: '#cfeae6',
    sidebarBottom: '#efd2bb',
    userBubble: '#eef5f3',
    userBubbleBorder: '#d6e5e2'
  },
  darkColors: {
    ...PREMIUM_DARK_BASE,
    background: '#171717',
    foreground: '#eeeeec',
    card: '#141414',
    cardForeground: '#eeeeec',
    muted: '#202322',
    mutedForeground: '#a3aaa8',
    popover: '#1f2221',
    popoverForeground: '#eeeeec',
    primary: '#a8e3da',
    primaryForeground: '#0e1514',
    secondary: '#262a29',
    secondaryForeground: '#eeeeec',
    accent: '#262a29',
    accentForeground: '#eeeeec',
    border: '#2b2f2e',
    input: '#2b2f2e',
    ring: '#7cc9bd',
    midground: '#7cc9bd',
    sidebarBackground: '#2c4544',
    sidebarBorder: '#36504f',
    sidebarTop: '#3b6f6c',
    sidebarBottom: '#7a3d1f',
    userBubble: '#1f2625',
    userBubbleBorder: '#2c3a38'
  }
}

/** Obsidian — blue-black glass: indigo rails over an ink page, a soft periwinkle accent. */
export const obsidianTheme: DesktopTheme = {
  name: 'obsidian',
  label: 'Obsidian',
  description: 'Ink page, indigo rails, periwinkle light',
  colors: {
    background: '#f6f7fb',
    foreground: '#171a26',
    card: '#ffffff',
    cardForeground: '#171a26',
    muted: '#eff1f8',
    mutedForeground: '#5d6380',
    popover: '#ffffff',
    popoverForeground: '#171a26',
    primary: '#3346b5',
    primaryForeground: '#ffffff',
    secondary: '#e9ecf6',
    secondaryForeground: '#171a26',
    accent: '#e9ecf6',
    accentForeground: '#171a26',
    border: '#dfe3f0',
    input: '#dfe3f0',
    ring: '#4b5fd6',
    midground: '#4b5fd6',
    destructive: '#cc3b3b',
    destructiveForeground: '#ffffff',
    sidebarBackground: '#e9ecf7',
    sidebarBorder: '#d9deef',
    sidebarTop: '#f2f4fc',
    sidebarBottom: '#c9d0ec',
    userBubble: '#eef1fb',
    userBubbleBorder: '#dbe0f2'
  },
  darkColors: {
    ...PREMIUM_DARK_BASE,
    background: '#10121a',
    foreground: '#e8eaf4',
    card: '#0d0f16',
    cardForeground: '#e8eaf4',
    muted: '#181b26',
    mutedForeground: '#9aa0bd',
    popover: '#181b26',
    popoverForeground: '#e8eaf4',
    primary: '#aab8ff',
    primaryForeground: '#0d0f16',
    secondary: '#1e2230',
    secondaryForeground: '#e8eaf4',
    accent: '#1e2230',
    accentForeground: '#e8eaf4',
    border: '#252a3a',
    input: '#252a3a',
    ring: '#8c9cff',
    midground: '#8c9cff',
    sidebarBackground: '#1d2134',
    sidebarBorder: '#272c44',
    sidebarTop: '#353d6e',
    sidebarBottom: '#0b0d15',
    userBubble: '#1a1e2c',
    userBubbleBorder: '#2a3048'
  }
}

/** Sandstone — warm paper and bronze: linen rails darkening to clay. */
export const sandstoneTheme: DesktopTheme = {
  name: 'sandstone',
  label: 'Sandstone',
  description: 'Warm paper, linen rails settling into clay',
  colors: {
    background: '#fbf8f3',
    foreground: '#2a221b',
    card: '#fffdf9',
    cardForeground: '#2a221b',
    muted: '#f4eee5',
    mutedForeground: '#76685a',
    popover: '#fffdf9',
    popoverForeground: '#2a221b',
    primary: '#8f4a1e',
    primaryForeground: '#ffffff',
    secondary: '#f1e9dd',
    secondaryForeground: '#2a221b',
    accent: '#f1e9dd',
    accentForeground: '#2a221b',
    border: '#e8dfd2',
    input: '#e8dfd2',
    ring: '#b4642d',
    midground: '#b4642d',
    destructive: '#c2412d',
    destructiveForeground: '#ffffff',
    sidebarBackground: '#f1e9de',
    sidebarBorder: '#e4d9c9',
    sidebarTop: '#f9f4ec',
    sidebarBottom: '#e4d6c1',
    userBubble: '#f6efe5',
    userBubbleBorder: '#e8dccb'
  },
  darkColors: {
    ...PREMIUM_DARK_BASE,
    background: '#181512',
    foreground: '#efe8df',
    card: '#14110f',
    cardForeground: '#efe8df',
    muted: '#221d19',
    mutedForeground: '#ab9f92',
    popover: '#221d19',
    popoverForeground: '#efe8df',
    primary: '#e8b48a',
    primaryForeground: '#14110f',
    secondary: '#29231e',
    secondaryForeground: '#efe8df',
    accent: '#29231e',
    accentForeground: '#efe8df',
    border: '#2f2822',
    input: '#2f2822',
    ring: '#d9935c',
    midground: '#d9935c',
    sidebarBackground: '#2c251f',
    sidebarBorder: '#362e27',
    sidebarTop: '#4b3e32',
    sidebarBottom: '#110e0b',
    userBubble: '#241f1a',
    userBubbleBorder: '#352d25'
  }
}

export const BUILTIN_THEMES: Record<string, DesktopTheme> = {
  nous: nousTheme,
  github: githubTheme,
  catppuccin: catppuccinTheme,
  everforest: everforestTheme,
  solarized: solarizedTheme,
  'nous-alt': nousAltTheme,
  midnight: midnightTheme,
  ember: emberTheme,
  mono: monoTheme,
  slate: slateTheme,
  cyberpunk: cyberpunkTheme,
  graphite: graphiteTheme,
  aurora: auroraTheme,
  obsidian: obsidianTheme,
  sandstone: sandstoneTheme
}

export const BUILTIN_THEME_LIST = Object.values(BUILTIN_THEMES)

/** Skin used when nothing is persisted or the persisted name is retired. */
export const DEFAULT_SKIN_NAME = 'nous'
