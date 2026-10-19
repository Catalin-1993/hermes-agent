// The chat's figures and cards — inline widgets and diagrams, the floating video player, the Library
// consent card — composed by zh.ts.
import type { TranslationOverrides } from './define-locale'

export const zhInlineWidget: NonNullable<TranslationOverrides['inlineWidget']> = {
  diagramLinesSkipped: count => `已省略图表中无法读取的 ${count} 行。`,
  networkAsk: hosts => `此小组件想要连接到 ${hosts}`,
  networkAllow: '允许',
  networkLater: '暂不',
  networkOn: hosts => `网络访问 · ${hosts}`,
  networkRevoke: '撤销',
  title: '小组件',
  addToPage: '添加到页面',
  pickerEmpty: '没有页面',
  pickerNew: '新建页面',
  pickerSearch: '查找页面…'
}

export const zhFloatingVideo: NonNullable<TranslationOverrides['floatingVideo']> = {
  popOut: '弹出',

  playingFloating: '正在浮动播放器中播放',

  bringBack: '移回此处',

  minimize: '最小化',

  restore: '显示播放器',

  close: '关闭',

  larger: '放大',

  smaller: '缩小',

  back10: '后退 10 秒',

  forward10: '前进 10 秒',

  play: '播放',

  pause: '暂停',

  dragHint: '拖动以移动 · 靠近角落松开即可固定'
}

export const zhLibraryConsent: NonNullable<NonNullable<TranslationOverrides['library']>['consent']> = {
  eyebrow: '资料库',
  actions: {
    read: 'Brain 想阅读一个页面',
    search: 'Brain 想搜索你的资料库',
    create: 'Brain 想创建一个页面',
    update: 'Brain 想编辑一个页面',
    delete: 'Brain 想把一个项目移到回收站',
    attach: 'Brain 想附加一个文件'
  },
  why: '原因',
  changes: '将会改变',
  preview: '预览',
  query: '搜索内容',
  approve: '允许',
  decline: '拒绝',
  footnote: '在你决定之前什么都不会发生。',
  expired: '此请求已不再有效。',
  edit: '编辑',
  titleLabel: '标题',
  contentLabel: '内容',
  editedNote: '已由你编辑',
  approveEdited: '保存我的版本'
}
