// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by es.ts.
import type { TranslationOverrides } from './define-locale'

export const esInlineWidget: NonNullable<TranslationOverrides['inlineWidget']> = {
  diagramLinesSkipped: count =>
    count === 1
      ? 'Se omitió 1 línea del diagrama que no se pudo leer.'
      : `Se omitieron ${count} líneas del diagrama que no se pudieron leer.`,
  networkAsk: hosts => `Este widget quiere conectarse a ${hosts}`,
  networkAllow: 'Permitir',
  networkLater: 'Ahora no',
  networkOn: hosts => `Acceso a internet · ${hosts}`,
  networkRevoke: 'Revocar',
  title: 'Widget',
  addToPage: 'Añadir a una página',
  pickerEmpty: 'Sin páginas',
  pickerNew: 'Página nueva',
  pickerSearch: 'Buscar una página…'
}

export const esFloatingVideo: NonNullable<TranslationOverrides['floatingVideo']> = {
  popOut: 'Separar',

  playingFloating: 'Reproduciendo en el reproductor flotante',

  bringBack: 'Traer de vuelta aquí',

  minimize: 'Minimizar',

  restore: 'Mostrar reproductor',

  close: 'Cerrar',

  larger: 'Más grande',

  smaller: 'Más pequeño',

  back10: 'Atrás 10 segundos',

  forward10: 'Adelante 10 segundos',

  play: 'Reproducir',

  pause: 'Pausa',

  dragHint: 'Arrastra para mover · suelta cerca de una esquina para fijarlo'
}

export const esLibraryConsent: NonNullable<NonNullable<TranslationOverrides['library']>['consent']> = {
  eyebrow: 'Biblioteca',
  actions: {
    read: 'Brain quiere leer una página',
    search: 'Brain quiere buscar en tu biblioteca',
    create: 'Brain quiere crear una página',
    update: 'Brain quiere editar una página',
    delete: 'Brain quiere mover un elemento a la papelera',
    attach: 'Brain quiere adjuntar un archivo'
  },
  why: 'Por qué',
  changes: 'Qué cambia',
  preview: 'Vista previa',
  query: 'Busca',
  approve: 'Aprobar',
  decline: 'Rechazar',
  footnote: 'No pasa nada hasta que decidas.',
  expired: 'Esta solicitud ya no está abierta.',
  edit: 'Editar',
  titleLabel: 'Título',
  contentLabel: 'Contenido',
  editedNote: 'Editado por ti',
  approveEdited: 'Guardar mi versión'
}
