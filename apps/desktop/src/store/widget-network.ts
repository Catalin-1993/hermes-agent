import { Codecs, persistentAtom } from '@/lib/persisted'

/**
 * The internet hosts a chat widget's owner approved, per widget file (JSON text, as a Library block
 * keeps its own). Kept on this device; a widget reaches only what its own document names AND is listed
 * here — see `networkAccess` in `@/lib/frame-policy`.
 */
export const $widgetNetwork = persistentAtom<Record<string, string>>(
  'hermes.desktop.widget-network.v1',
  {},
  Codecs.stringRecord
)

export function setWidgetHosts(file: string, hosts: readonly string[]): void {
  const { [file]: _previous, ...rest } = $widgetNetwork.get()

  $widgetNetwork.set(hosts.length ? { ...rest, [file]: JSON.stringify(hosts) } : rest)
}
