// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by en.ts.
import type { Translations } from './types'

export const enInlineWidget: Translations['inlineWidget'] = {
  diagramLinesSkipped: count =>
    count === 1
      ? '1 line of the diagram could not be read and was left out.'
      : `${count} lines of the diagram could not be read and were left out.`,
  networkAsk: hosts => `This widget wants to connect to ${hosts}`,
  networkAllow: 'Allow',
  networkLater: 'Not now',
  networkOn: hosts => `Internet access · ${hosts}`,
  networkRevoke: 'Revoke',
  title: 'Widget',
  addToPage: 'Add to page',
  pickerEmpty: 'No pages',
  pickerNew: 'New page',
  pickerSearch: 'Find a page…'
}

export const enFloatingVideo: Translations['floatingVideo'] = {
  popOut: 'Pop out',

  playingFloating: 'Playing in the floating player',

  bringBack: 'Bring back here',

  minimize: 'Minimize',

  restore: 'Show player',

  close: 'Close',

  larger: 'Larger',

  smaller: 'Smaller',

  back10: 'Back 10 seconds',

  forward10: 'Forward 10 seconds',

  play: 'Play',

  pause: 'Pause',

  dragHint: 'Drag to move · drop near a corner to pin it'
}

export const enLibraryConsent: Translations['library']['consent'] = {
  eyebrow: 'Library',
  actions: {
    read: 'Brain wants to read a page',
    search: 'Brain wants to search your Library',
    create: 'Brain wants to create a page',
    update: 'Brain wants to edit a page',
    delete: 'Brain wants to move an item to the Trash',
    attach: 'Brain wants to attach a file'
  },
  why: 'Why',
  changes: 'What changes',
  preview: 'Preview',
  query: 'Looking for',
  approve: 'Approve',
  decline: 'Decline',
  footnote: 'Nothing happens until you decide.',
  expired: 'This request is no longer open.',
  edit: 'Edit',
  titleLabel: 'Title',
  contentLabel: 'Content',
  editedNote: 'Edited by you',
  approveEdited: 'Save my version'
}
