/** Brain: what the main agent's screen bridge answers (brain-screen.ts), shared with the renderer. */

export interface BrainScreenStatus {
  enabled: boolean
  permission: 'granted' | 'needed'
}

export type BrainScreenFrame =
  { ok: true; dataUrl: string } | { ok: false; reason: 'off' | 'permission' | 'unavailable' }

export type BrainScreenShot =
  { ok: true; png: Uint8Array } | { ok: false; reason: 'declined' | 'permission' | 'unavailable' }

export interface BrainScreenApi {
  get(): Promise<BrainScreenStatus>
  setEnabled(enabled: boolean): Promise<BrainScreenStatus>
  frame(): Promise<BrainScreenFrame>
  capture(): Promise<BrainScreenShot>
  openPermissionSettings(): Promise<void>
}
