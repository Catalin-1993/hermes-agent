// The chat's figures and cards: inline widgets and diagrams, the floating video player, the Library consent card.
export interface InlineWidgetTranslations {
  networkAsk: (hosts: string) => string
  networkAllow: string
  networkLater: string
  networkOn: (hosts: string) => string
  networkRevoke: string
  addToPage: string
  pickerEmpty: string
  pickerNew: string
  pickerSearch: string
  title: string
  diagramLinesSkipped: (count: number) => string
}

export interface FloatingVideoTranslations {
  popOut: string
  playingFloating: string
  bringBack: string
  minimize: string
  restore: string
  close: string
  larger: string
  smaller: string
  back10: string
  forward10: string
  play: string
  pause: string
  dragHint: string
}

export interface LibraryConsentTranslations {
  eyebrow: string
  actions: Record<'attach' | 'create' | 'delete' | 'read' | 'search' | 'update', string>
  why: string
  changes: string
  preview: string
  query: string
  approve: string
  decline: string
  footnote: string
  expired: string
  edit: string
  titleLabel: string
  contentLabel: string
  editedNote: string
  approveEdited: string
}
