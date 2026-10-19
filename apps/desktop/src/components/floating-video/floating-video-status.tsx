import { useStore } from '@nanostores/react'

import { STATUSBAR_ACTION_CLASS } from '@/app/shell/statusbar-controls'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { Forward10, PlayerPause, PlayerPlay, Rewind10, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { postYoutubeCommand } from '@/lib/youtube-control'
import {
  $floatingPlayback,
  $floatingVideo,
  closeFloatingVideo,
  getFloatingFrame,
  setFloatingMinimized
} from '@/store/floating-video'

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, '0')

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

/**
 * The minimized floating player in the status bar: play/pause, ten seconds back and forward, the title
 * (click it to bring the player back on screen) and close. Shown only while the player is minimized.
 */
export function FloatingVideoStatus() {
  const { t } = useI18n()
  const copy = t.floatingVideo
  const video = useStore($floatingVideo)
  const playback = useStore($floatingPlayback)

  if (!video) {
    return null
  }

  const seek = (delta: number) => {
    const target = Math.max(0, playback.currentTime + delta)

    postYoutubeCommand(getFloatingFrame(), 'seekTo', [target, true])
    $floatingPlayback.set({ ...playback, currentTime: target })
  }

  const toggle = () => {
    postYoutubeCommand(getFloatingFrame(), playback.playing ? 'pauseVideo' : 'playVideo')
    $floatingPlayback.set({ ...playback, playing: !playback.playing })
  }

  const icon = 'size-3.5'

  return (
    <span className="flex h-full items-center" data-statusbar="floating-video">
      <Tip label={copy.back10}>
        <button aria-label={copy.back10} className={STATUSBAR_ACTION_CLASS} onClick={() => seek(-10)} type="button">
          <Rewind10 className={icon} />
        </button>
      </Tip>
      <Tip label={playback.playing ? copy.pause : copy.play}>
        <button
          aria-label={playback.playing ? copy.pause : copy.play}
          className={cn(STATUSBAR_ACTION_CLASS, 'text-(--ui-text-primary)')}
          onClick={toggle}
          type="button"
        >
          {playback.playing ? <PlayerPause className={icon} /> : <PlayerPlay className={icon} />}
        </button>
      </Tip>
      <Tip label={copy.forward10}>
        <button aria-label={copy.forward10} className={STATUSBAR_ACTION_CLASS} onClick={() => seek(10)} type="button">
          <Forward10 className={icon} />
        </button>
      </Tip>
      <Tip label={copy.restore}>
        <button
          aria-label={copy.restore}
          className={cn(STATUSBAR_ACTION_CLASS, 'max-w-48 gap-1.5')}
          onClick={() => setFloatingMinimized(false)}
          type="button"
        >
          <span className="truncate">{video.title}</span>
          <span className="shrink-0 tabular-nums opacity-70">{clock(playback.currentTime)}</span>
        </button>
      </Tip>
      <Tip label={copy.close}>
        <button aria-label={copy.close} className={STATUSBAR_ACTION_CLASS} onClick={closeFloatingVideo} type="button">
          <X className={icon} />
        </button>
      </Tip>
    </span>
  )
}
