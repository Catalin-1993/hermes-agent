import { useEffect, useRef } from 'react'

import { BRAIN_SCREEN_SHARE_EVENT, type BrainScreenShareDetail } from '@/store/brain-screen'

import { type ComposerTarget, getActiveComposer, getVisibleComposerSurfaceId } from '../focus'
import type { ChatBarProps } from '../types'

/**
 * Brain: the composer on screen takes the picture the Pro panel's "Share screenshot" took (store/brain-screen.ts),
 * through the same image ingestion a paste uses. Only the active, visible composer answers, so the picture lands
 * in the draft the person is looking at.
 */
export function useBrainScreenShare({
  onAttachImageBlob,
  surfaceId,
  target,
  visible
}: {
  onAttachImageBlob: ChatBarProps['onAttachImageBlob']
  surfaceId: null | string
  target: ComposerTarget
  visible: boolean
}) {
  const attach = useRef(onAttachImageBlob)
  attach.current = onAttachImageBlob

  useEffect(() => {
    if (!surfaceId || !visible) {
      return
    }

    const onShare = (event: Event) => {
      const detail = (event as CustomEvent<BrainScreenShareDetail>).detail

      if (
        detail.taken ||
        !attach.current ||
        getActiveComposer() !== target ||
        getVisibleComposerSurfaceId(target) !== surfaceId
      ) {
        return
      }

      detail.taken = true
      void attach.current(detail.blob)
    }

    window.addEventListener(BRAIN_SCREEN_SHARE_EVENT, onShare)

    return () => window.removeEventListener(BRAIN_SCREEN_SHARE_EVENT, onShare)
  }, [surfaceId, target, visible])
}
