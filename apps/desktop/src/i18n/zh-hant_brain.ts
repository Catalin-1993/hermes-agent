import type { TranslationOverrides } from './define-locale'

/** Brain's own copy for this locale (Library cards, inline widgets, profile menu, sidebar), kept beside the
 *  community's section files so a sync from upstream never drops it. Merged into the overlay in zh-hant.ts. */
export const zhHantBrain = {
  agentCards: {
    addToCalendar: '加入行事曆',
    allDay: '全天',
    askAbout: '了解更多',
    askAboutPrompt: name => `再跟我說說${name}。`,
    buy: '購買',
    buyPrompt: (name, merchant) => `我想${merchant ? `在${merchant}` : ''}購買${name}。下單前請先帶我確認每一步。`,
    closed: '已打烊',
    directions: '路線',
    open: '營業中',
    openOnYouTube: '在 YouTube 開啟',
    places: n => `${n} 個地點`,
    playVideo: title => `播放 ${title}`,
    reviews: n => `${n.toLocaleString()} 則評論`,
    videoUntitled: 'YouTube 影片',
    view: '查看',
    views: count => `${count} 次觀看`,
    website: '網站'
  },
  assistant: {
    approval: {
      title: '執行此命令？',
      titleAction: '允許此動作？'
    },
    clarify: {
      cardTitle: count => (count === 1 ? 'Brain 有一個問題' : 'Brain 有幾個問題')
    }
  },
  floatingVideo: {
    popOut: '彈出',
    playingFloating: '正在浮動播放器中播放',
    bringBack: '移回此處',
    minimize: '最小化',
    restore: '顯示播放器',
    close: '關閉',
    larger: '放大',
    smaller: '縮小',
    back10: '倒退 10 秒',
    forward10: '前進 10 秒',
    play: '播放',
    pause: '暫停',
    dragHint: '拖曳以移動 · 靠近角落放開即可固定'
  },
  inlineWidget: {
    diagramLinesSkipped: count => `已省略圖表中無法讀取的 ${count} 行。`,
    addToPage: '加入頁面',
    networkAllow: '允許',
    networkAsk: hosts => `此小工具想要連線到 ${hosts}`,
    networkLater: '暫不',
    networkOn: hosts => `網際網路存取 · ${hosts}`,
    networkRevoke: '撤銷',
    pickerEmpty: '沒有頁面',
    pickerNew: '新增頁面',
    pickerSearch: '尋找頁面…',
    title: '小工具'
  },
  profiles: {
    changeName: '變更名稱…',
    changePhoto: '更換相片…',
    editProfile: '編輯資料',
    personalization: '個人化',
    removePhoto: '移除相片'
  },
  settings: {
    appearance: {
      flipPanesDesc: '將工作階段側邊欄放到右側，檔案瀏覽器放到左側。',
      flipPanesTitle: '交換側邊欄位置'
    },
    nav: {
      messaging: '訊息平台'
    }
  },
  shell: {
    modelOptions: {
      off: '關閉'
    }
  },
  sidebar: {
    navEdit: '編輯',
    navEditTitle: '在側邊欄中顯示',
    navMore: '更多',
    notifications: '通知',
    projectName: 'Brain'
  },
  titlebar: {
    back: '上一頁',
    forward: '下一頁',
    modeSwitch: '側欄模式',
    unreadNotifications: count => `${count} 則未讀通知`
  }
} satisfies TranslationOverrides
