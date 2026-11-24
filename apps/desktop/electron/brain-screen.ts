/**
 * Brain: the main agent's own screen in the Pro panel ("What Brain sees") and a one-click "Share screenshot".
 *
 * Off until the person turns it on, and the choice lives here in main (`brain-screen.json`), never in the
 * renderer. While it is on, the panel shows a small live frame of the display the pointer is on, refreshed while
 * the panel is open; nothing is sent to the agent from that view. "Share screenshot" attaches one full picture to
 * the message being written: with the view on it is taken straight away, with it off main asks first with a native
 * dialog, so a renderer alone can never take a picture of the screen nobody agreed to.
 *
 * Only the app's own top frame may call in (the same check the screenshot gesture uses).
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  screen,
  shell,
  systemPreferences
} from 'electron'

import type { BrainScreenFrame, BrainScreenShot, BrainScreenStatus } from './brain-screen-types'

// The question main asks before a picture is taken while the live view is off.
const ASK = {
  buttons: ['Share screenshot', 'Cancel'],
  detail: 'Brain gets one picture of the screen you are on, attached to the message you are writing.',
  message: 'Share your screen with Brain?'
}

const FRAME_WIDTH = 640
const SHOT_MAX = 2560

/** The display under the pointer, as a picture at most `maxSide` wide — or null when it cannot be read. */
async function grabDisplay(maxSide: number) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { height, width } = display.size
  const scale = Math.min(display.scaleFactor || 1, maxSide / Math.max(width, height))

  const sources = await desktopCapturer.getSources({
    fetchWindowIcons: false,
    thumbnailSize: { height: Math.round(height * scale), width: Math.round(width * scale) },
    types: ['screen']
  })

  const source = sources.find(item => item.display_id === String(display.id)) ?? sources[0]

  return source && !source.thumbnail.isEmpty() ? source.thumbnail : null
}

export function installBrainScreen({ rendererUrl }: { rendererUrl: string }): () => void {
  const configPath = path.join(app.getPath('userData'), 'brain-screen.json')
  const expected = new URL(rendererUrl)
  let enabled = false

  try {
    enabled = JSON.parse(readFileSync(configPath, 'utf8')).enabled === true
  } catch {
    // No file (or a broken one) means the person never turned it on.
  }

  const permitted = () =>
    process.platform !== 'darwin' || systemPreferences.getMediaAccessStatus('screen') === 'granted'

  const status = (): BrainScreenStatus => ({ enabled, permission: permitted() ? 'granted' : 'needed' })

  const trusted = (event: IpcMainInvokeEvent): BrowserWindow | null => {
    const win = BrowserWindow.fromWebContents(event.sender)

    if (!win || win.isDestroyed() || event.senderFrame !== event.sender.mainFrame) {
      return null
    }

    try {
      const url = new URL(event.senderFrame.url)

      return url.protocol === expected.protocol && url.host === expected.host && url.pathname === expected.pathname
        ? win
        : null
    } catch {
      return null
    }
  }

  const channels: string[] = []

  const handle = (name: string, run: (win: BrowserWindow, value: unknown) => unknown) => {
    const channel = `hermes:brain-screen:${name}`
    channels.push(channel)
    ipcMain.handle(channel, (event, value) => {
      const win = trusted(event)

      if (!win) {
        throw new Error('Brain screen request from an untrusted frame')
      }

      return run(win, value)
    })
  }

  handle('get', () => status())

  handle('set', async (_win, value) => {
    if (typeof value !== 'boolean') {
      throw new Error('Brain screen setting must be a boolean')
    }

    mkdirSync(path.dirname(configPath), { recursive: true })
    writeFileSync(`${configPath}.tmp`, JSON.stringify({ enabled: value }), { mode: 0o600 })
    renameSync(`${configPath}.tmp`, configPath)
    enabled = value

    if (value && !permitted()) {
      // macOS asks for Screen Recording only when something tries to capture; a 1px probe is discarded.
      await desktopCapturer
        .getSources({ fetchWindowIcons: false, thumbnailSize: { height: 1, width: 1 }, types: ['screen'] })
        .catch(() => undefined)
    }

    return status()
  })

  handle('frame', async (): Promise<BrainScreenFrame> => {
    if (!enabled) {
      return { ok: false, reason: 'off' }
    }

    if (!permitted()) {
      return { ok: false, reason: 'permission' }
    }

    const image = await grabDisplay(FRAME_WIDTH).catch(() => null)

    return image
      ? { dataUrl: `data:image/jpeg;base64,${image.toJPEG(72).toString('base64')}`, ok: true }
      : { ok: false, reason: 'unavailable' }
  })

  handle('capture', async (win): Promise<BrainScreenShot> => {
    if (!enabled) {
      const { response } = await dialog.showMessageBox(win, {
        ...ASK,
        cancelId: 1,
        defaultId: 0,
        type: 'question'
      })

      if (response !== 0) {
        return { ok: false, reason: 'declined' }
      }
    }

    if (!permitted()) {
      return { ok: false, reason: 'permission' }
    }

    const image = await grabDisplay(SHOT_MAX).catch(() => null)

    return image ? { ok: true, png: new Uint8Array(image.toPNG()) } : { ok: false, reason: 'unavailable' }
  })

  handle('permission', async () => {
    if (process.platform === 'darwin') {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
    }
  })

  const dispose = () => {
    channels.forEach(channel => ipcMain.removeHandler(channel))
    app.removeListener('will-quit', dispose)
  }

  app.once('will-quit', dispose)

  return dispose
}
