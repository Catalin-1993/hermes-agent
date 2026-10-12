import { Codecs, persistentAtom } from '@/lib/persisted'

/**
 * A photo per profile, for the account row at the sidebar's foot. Kept on this device (a profile's
 * own files live with its gateway, which may be another machine), as small square data URLs.
 */
export const $profileAvatars = persistentAtom<Record<string, string>>(
  'hermes.desktop.profile-avatars.v1',
  {},
  Codecs.stringRecord
)

const EDGE = 160

export function setProfileAvatar(profile: string, image: string): void {
  $profileAvatars.set({ ...$profileAvatars.get(), [profile]: image })
}

export function clearProfileAvatar(profile: string): void {
  const { [profile]: _removed, ...rest } = $profileAvatars.get()

  $profileAvatars.set(rest)
}

/** A picked image, cropped to its centre square and scaled down — or null if it cannot be read. */
export async function avatarFromFile(file: File): Promise<null | string> {
  try {
    const bitmap = await createImageBitmap(file)
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = EDGE
    canvas.height = EDGE

    canvas
      .getContext('2d')
      ?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, EDGE, EDGE)
    bitmap.close()

    return canvas.toDataURL('image/webp', 0.9)
  } catch {
    return null
  }
}
