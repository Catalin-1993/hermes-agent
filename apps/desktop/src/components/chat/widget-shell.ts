import { CARD_SURFACE_CLASS } from '@/components/ui/hermes-card'

/**
 * Inline transcript widgets — the few tool results that render as a panel the
 * user reads or acts on (a clarify question, an artifact card) rather than as
 * a scaffold line.
 *
 * They share one shell so they cannot drift apart. They used to each pick their
 * own: clarify sat on a 2px radius over the chat backdrop's own color (a card
 * you could only see by its hairline), the artifact card on a hardcoded 10px
 * over nothing. One radius one rung above the composer, one raised surface —
 * the agent cards' (`CARD_SURFACE_CLASS` in components/ui/hermes-card.tsx), so
 * an approval, a question and an artifact read as one family.
 */
export const WIDGET_SHELL_CLASS = `${CARD_SURFACE_CLASS} px-3.5 py-3`
