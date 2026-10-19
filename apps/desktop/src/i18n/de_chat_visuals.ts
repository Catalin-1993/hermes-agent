// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by de.ts.
import type { TranslationOverrides } from './define-locale'

export const deInlineWidget: NonNullable<TranslationOverrides['inlineWidget']> = {
  diagramLinesSkipped: count =>
    count === 1
      ? '1 Zeile des Diagramms war unlesbar und wurde ausgelassen.'
      : `${count} Zeilen des Diagramms waren unlesbar und wurden ausgelassen.`,
  networkAsk: hosts => `Dieses Widget möchte sich mit ${hosts} verbinden`,
  networkAllow: 'Erlauben',
  networkLater: 'Nicht jetzt',
  networkOn: hosts => `Internetzugriff · ${hosts}`,
  networkRevoke: 'Widerrufen',
  title: 'Widget',
  addToPage: 'Zu Seite hinzufügen',
  pickerEmpty: 'Keine Seiten',
  pickerNew: 'Neue Seite',
  pickerSearch: 'Seite suchen…'
}

export const deFloatingVideo: NonNullable<TranslationOverrides['floatingVideo']> = {
  popOut: 'Ablösen',

  playingFloating: 'Läuft im schwebenden Player',

  bringBack: 'Hierher zurückholen',

  minimize: 'Minimieren',

  restore: 'Player zeigen',

  close: 'Schließen',

  larger: 'Größer',

  smaller: 'Kleiner',

  back10: '10 Sekunden zurück',

  forward10: '10 Sekunden vor',

  play: 'Abspielen',

  pause: 'Pause',

  dragHint: 'Ziehen zum Verschieben · nahe einer Ecke ablegen zum Anheften'
}

export const deLibraryConsent: NonNullable<NonNullable<TranslationOverrides['library']>['consent']> = {
  eyebrow: 'Bibliothek',
  actions: {
    read: 'Brain möchte eine Seite lesen',
    search: 'Brain möchte Ihre Bibliothek durchsuchen',
    create: 'Brain möchte eine Seite erstellen',
    update: 'Brain möchte eine Seite bearbeiten',
    delete: 'Brain möchte ein Element in den Papierkorb legen',
    attach: 'Brain möchte eine Datei anhängen'
  },
  why: 'Warum',
  changes: 'Was sich ändert',
  preview: 'Vorschau',
  query: 'Sucht nach',
  approve: 'Zulassen',
  decline: 'Ablehnen',
  footnote: 'Nichts passiert, bevor Sie entscheiden.',
  expired: 'Diese Anfrage ist nicht mehr offen.',
  edit: 'Bearbeiten',
  titleLabel: 'Titel',
  contentLabel: 'Inhalt',
  editedNote: 'Von dir bearbeitet',
  approveEdited: 'Meine Fassung speichern'
}
