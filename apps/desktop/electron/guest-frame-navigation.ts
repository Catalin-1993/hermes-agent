/**
 * Sealed guest documents never navigate themselves to the web.
 *
 * Untrusted HTML the app renders inline — a Library interactive block, an HTML file preview, a widget
 * drawn in chat (`about:srcdoc`) — runs in a frame with an opaque origin and a Content-Security-Policy
 * that shuts the network (or opens it to the hosts its owner approved). A CSP does not govern
 * navigation, though: the frame could still send itself to `https://elsewhere/?…` and carry its
 * document, its saved data and whatever the user typed into it out of that seal. A `data:` or
 * `srcdoc` subframe may only go to another `data:` or `about:` page. Frames that start on the web
 * (plugin embeds, previews of a page) are not sealed this way and keep navigating as before.
 */

export interface FrameNavigationLike {
  /** The URL of the frame asking to navigate — the initiator's when known, else the frame's own ('' when unknown). */
  fromUrl: string
  isMainFrame: boolean
  toUrl: string
}

export function blocksGuestFrameNavigation({ fromUrl, isMainFrame, toUrl }: FrameNavigationLike): boolean {
  if (isMainFrame || !/^(?:data:|about:srcdoc)/i.test(fromUrl)) {
    return false
  }

  return !/^(data|about):/i.test(toUrl.trim())
}
