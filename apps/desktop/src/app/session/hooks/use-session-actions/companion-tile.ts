import { markCompanionChat } from '@/store/side-chat'

/** A chat opened beside a page (a companion) is marked BEFORE its tile exists. The layout reads the mark when it
 *  registers the tile — its own fixed width, no tab strip — so a mark made afterwards had the chat open at a shared
 *  width and then shrink to its own a moment later. */
export function markCompanionTile(storedSessionId: string, options?: { companion?: boolean }) {
  if (options?.companion) {
    markCompanionChat(storedSessionId)
  }
}
