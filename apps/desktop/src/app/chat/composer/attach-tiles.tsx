/**
 * Brain: the top of the composer's + menu — Camera, Images, Files and Library as four square tiles, the rest of
 * the menu as a list below them — and the camera dialog the Camera tile opens (a live preview, one button that
 * takes the photo and attaches it to the draft, like a pasted image).
 */

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

interface Tile {
  disabled?: boolean
  icon: string
  key: string
  label: string
  onSelect?: () => void
}

export function AttachTiles({
  onCamera,
  onLibrary,
  onPickFiles,
  onPickImages
}: {
  onCamera?: () => void
  onLibrary?: () => void
  onPickFiles?: () => void
  onPickImages?: () => void
}) {
  const { t } = useI18n()
  const labels = t.composer.attachTiles

  const tiles: Tile[] = [
    { icon: 'device-camera', key: 'camera', label: labels.camera, onSelect: onCamera },
    { icon: 'file-media', key: 'images', label: labels.images, onSelect: onPickImages },
    { icon: 'files', key: 'files', label: labels.files, onSelect: onPickFiles },
    { icon: 'library', key: 'library', label: labels.library, onSelect: onLibrary }
  ]

  return (
    <div className="grid grid-cols-4 gap-1 p-1" data-slot="attach-tiles">
      {tiles.map(tile => (
        <DropdownMenuItem
          className={cn(
            'group/tile flex aspect-square h-auto flex-col items-center justify-center gap-1.5 rounded-lg p-0',
            'border border-(--ui-stroke-tertiary) bg-(--ui-bg-quaternary,transparent) text-[0.6875rem] text-(--ui-text-secondary)',
            'transition-colors duration-150 focus:border-(--ui-stroke-secondary) focus:text-foreground'
          )}
          disabled={!tile.onSelect}
          key={tile.key}
          onSelect={tile.onSelect}
        >
          <span className="grid size-8 place-items-center rounded-full bg-(--chrome-action-hover) text-foreground transition-transform duration-200 group-focus/tile:scale-105">
            <Codicon name={tile.icon} size="1rem" />
          </span>
          {tile.label}
        </DropdownMenuItem>
      ))}
    </div>
  )
}

/** A live camera preview and one shutter button; the photo goes to `onCapture` as a JPEG. */
export function CameraDialog({
  onCapture,
  onOpenChange,
  open
}: {
  onCapture: (photo: Blob) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useI18n()
  const copy = t.composer.camera
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    let stream: MediaStream | null = null
    let cancelled = false

    setReady(false)
    setFailed(false)

    navigator.mediaDevices
      ?.getUserMedia({ audio: false, video: { height: { ideal: 1080 }, width: { ideal: 1920 } } })
      .then(media => {
        if (cancelled) {
          media.getTracks().forEach(track => track.stop())

          return
        }

        stream = media

        if (video.current) {
          video.current.srcObject = media
        }
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [open])

  const take = () => {
    const el = video.current

    if (!el?.videoWidth) {
      return
    }

    const canvas = document.createElement('canvas')

    canvas.width = el.videoWidth
    canvas.height = el.videoHeight
    canvas.getContext('2d')?.drawImage(el, 0, 0)
    canvas.toBlob(
      blob => {
        if (blob) {
          onCapture(blob)
          onOpenChange(false)
        }
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl gap-3 p-4">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="sr-only">{copy.take}</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          {failed ? (
            <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
              {copy.unavailable}
            </p>
          ) : (
            <video
              autoPlay
              className={cn(
                'size-full -scale-x-100 object-cover transition-opacity duration-300',
                ready ? 'opacity-100' : 'opacity-0'
              )}
              muted
              onLoadedData={() => setReady(true)}
              playsInline
              ref={video}
            />
          )}
        </div>
        <div className="flex justify-center">
          <Button className="gap-2 rounded-full px-5" disabled={!ready || failed} onClick={take} type="button">
            <Codicon name="device-camera" size="0.875rem" />
            {copy.take}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
