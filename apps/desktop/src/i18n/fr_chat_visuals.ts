// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by fr.ts.
import type { TranslationOverrides } from './define-locale'

export const frInlineWidget: NonNullable<TranslationOverrides['inlineWidget']> = {
  diagramLinesSkipped: count =>
    count === 1
      ? '1 ligne du diagramme illisible a été omise.'
      : `${count} lignes du diagramme illisibles ont été omises.`,
  networkAsk: hosts => `Ce widget souhaite se connecter à ${hosts}`,
  networkAllow: 'Autoriser',
  networkLater: 'Pas maintenant',
  networkOn: hosts => `Accès à Internet · ${hosts}`,
  networkRevoke: 'Révoquer',
  title: 'Widget',
  addToPage: 'Ajouter à une page',
  pickerEmpty: 'Aucune page',
  pickerNew: 'Nouvelle page',
  pickerSearch: 'Rechercher une page…'
}

export const frFloatingVideo: NonNullable<TranslationOverrides['floatingVideo']> = {
  popOut: 'Détacher',

  playingFloating: 'Lecture dans le lecteur flottant',

  bringBack: 'Ramener ici',

  minimize: 'Réduire',

  restore: 'Afficher le lecteur',

  close: 'Fermer',

  larger: 'Plus grand',

  smaller: 'Plus petit',

  back10: 'Reculer de 10 secondes',

  forward10: 'Avancer de 10 secondes',

  play: 'Lire',

  pause: 'Pause',

  dragHint: 'Glissez pour déplacer · déposez près d’un coin pour l’épingler'
}

export const frLibraryConsent: NonNullable<NonNullable<TranslationOverrides['library']>['consent']> = {
  eyebrow: 'Bibliothèque',
  actions: {
    read: 'Brain veut lire une page',
    search: 'Brain veut rechercher dans votre bibliothèque',
    create: 'Brain veut créer une page',
    update: 'Brain veut modifier une page',
    delete: 'Brain veut mettre un élément à la corbeille',
    attach: 'Brain veut joindre un fichier'
  },
  why: 'Pourquoi',
  changes: 'Ce qui change',
  preview: 'Aperçu',
  query: 'Recherche',
  approve: 'Approuver',
  decline: 'Refuser',
  footnote: 'Rien ne se passe tant que vous n’avez pas décidé.',
  expired: 'Cette demande n’est plus ouverte.',
  edit: 'Modifier',
  titleLabel: 'Titre',
  contentLabel: 'Contenu',
  editedNote: 'Modifié par vous',
  approveEdited: 'Enregistrer ma version'
}
