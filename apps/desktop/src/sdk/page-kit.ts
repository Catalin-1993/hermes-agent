// What a page is drawn with beyond the primitives — the chat's own figures, the shell's tabs and the
// canonical loader — so a plugin page and the conversation share one design line. The SDK barrel
// re-exports it.

/** A chart drawn as data — the same native renderer, palette and tools as a ```chart block in chat.
 *  Build the spec with `parseChartSpec` from the same JSON the chat fence takes; `toolbar={false}` drops
 *  the full-screen and Add-to-page buttons for a figure that is part of the page itself. */
export { ChartFigure } from '@/components/assistant-ui/charts/chart-figure'
export { type ChartSpec, parseChartSpec } from '@/components/assistant-ui/charts/chart-spec'
/** The one card every figure in the chat sits in (corners, hairline, surface, shadow, padding), for a
 *  plugin page that shows its own figures beside native charts. */
export { FIGURE_CARD_CLASS } from '@/components/assistant-ui/figure-card'
/** The app's canonical loader (animated curves; `lemniscate-bloom` for long
 *  page loads) — the same one every core page uses. */
export { Loader, type LoaderType } from '@/components/ui/loader'
/** Tabs as the shell draws them; inside `WorkspacePageHeaderControl bare` they stand in the page header. */
export { PaneTab, PaneTabLabel, PaneTabStrip } from '@/components/ui/pane-tab'
