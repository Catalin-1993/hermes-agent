// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by ru.ts.
import type { TranslationOverrides } from './define-locale'

export const ruInlineWidget: NonNullable<TranslationOverrides['inlineWidget']> = {
  diagramLinesSkipped: count => `Пропущено нечитаемых строк диаграммы: ${count}.`,
  networkAsk: hosts => `Этому виджету нужно подключиться к ${hosts}`,
  networkAllow: 'Разрешить',
  networkLater: 'Не сейчас',
  networkOn: hosts => `Доступ в интернет · ${hosts}`,
  networkRevoke: 'Отозвать',
  title: 'Виджет',
  addToPage: 'Добавить на страницу',
  pickerEmpty: 'Нет страниц',
  pickerNew: 'Новая страница',
  pickerSearch: 'Найти страницу…'
}

export const ruFloatingVideo: NonNullable<TranslationOverrides['floatingVideo']> = {
  popOut: 'Открепить',

  playingFloating: 'Воспроизводится в плавающем плеере',

  bringBack: 'Вернуть сюда',

  minimize: 'Свернуть',

  restore: 'Показать плеер',

  close: 'Закрыть',

  larger: 'Больше',

  smaller: 'Меньше',

  back10: 'Назад на 10 секунд',

  forward10: 'Вперёд на 10 секунд',

  play: 'Играть',

  pause: 'Пауза',

  dragHint: 'Перетащите для перемещения · отпустите у угла, чтобы закрепить'
}

export const ruLibraryConsent: NonNullable<NonNullable<TranslationOverrides['library']>['consent']> = {
  eyebrow: 'Библиотека',
  actions: {
    read: 'Brain хочет прочитать страницу',
    search: 'Brain хочет выполнить поиск в библиотеке',
    create: 'Brain хочет создать страницу',
    update: 'Brain хочет изменить страницу',
    delete: 'Brain хочет переместить элемент в корзину',
    attach: 'Brain хочет прикрепить файл'
  },
  why: 'Зачем',
  changes: 'Что изменится',
  preview: 'Предпросмотр',
  query: 'Ищет',
  approve: 'Разрешить',
  decline: 'Отклонить',
  footnote: 'Ничего не произойдёт, пока вы не решите.',
  expired: 'Этот запрос больше не активен.',
  edit: 'Изменить',
  titleLabel: 'Заголовок',
  contentLabel: 'Содержание',
  editedNote: 'Изменено вами',
  approveEdited: 'Сохранить мою версию'
}
