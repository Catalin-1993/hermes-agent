// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by ja.ts.
import type { TranslationOverrides } from './define-locale'

export const jaInlineWidget: NonNullable<TranslationOverrides['inlineWidget']> = {
  diagramLinesSkipped: count => `読み取れなかった図の${count}行を省略しました。`,
  networkAsk: hosts => `このウィジェットが ${hosts} への接続を求めています`,
  networkAllow: '許可',
  networkLater: '今はしない',
  networkOn: hosts => `インターネットアクセス · ${hosts}`,
  networkRevoke: '取り消す',
  title: 'ウィジェット',
  addToPage: 'ページに追加',
  pickerEmpty: 'ページなし',
  pickerNew: '新しいページ',
  pickerSearch: 'ページを検索…'
}

export const jaFloatingVideo: NonNullable<TranslationOverrides['floatingVideo']> = {
  popOut: 'ポップアウト',

  playingFloating: 'フローティングプレーヤーで再生中',

  bringBack: 'ここに戻す',

  minimize: '最小化',

  restore: 'プレーヤーを表示',

  close: '閉じる',

  larger: '大きく',

  smaller: '小さく',

  back10: '10秒戻る',

  forward10: '10秒進む',

  play: '再生',

  pause: '一時停止',

  dragHint: 'ドラッグで移動・角の近くで離すと固定'
}

export const jaLibraryConsent: NonNullable<NonNullable<TranslationOverrides['library']>['consent']> = {
  eyebrow: 'ライブラリ',
  actions: {
    read: 'Brain がページを読もうとしています',
    search: 'Brain がライブラリを検索しようとしています',
    create: 'Brain がページを作成しようとしています',
    update: 'Brain がページを編集しようとしています',
    delete: 'Brain が項目をゴミ箱に移動しようとしています',
    attach: 'Brain がファイルを添付しようとしています'
  },
  why: '理由',
  changes: '変更内容',
  preview: 'プレビュー',
  query: '検索語',
  approve: '許可',
  decline: '拒否',
  footnote: 'あなたが決めるまで何も起こりません。',
  expired: 'このリクエストはすでに終了しています。',
  edit: '編集',
  titleLabel: 'タイトル',
  contentLabel: '内容',
  editedNote: 'あなたが編集',
  approveEdited: '自分の版を保存'
}
