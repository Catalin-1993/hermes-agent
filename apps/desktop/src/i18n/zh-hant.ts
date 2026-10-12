import { defineLocale, type TranslationOverrides } from './define-locale'
import { introZhHant } from './intro-zh-hant'
import { zhHantArtifacts } from './zh-hant_artifacts'
import { zhHantAssistant } from './zh-hant_assistant'
import { zhHantBoot } from './zh-hant_boot'
import { zhHantBrain } from './zh-hant_brain'
import { zhHantCapabilities } from './zh-hant_capabilities'
import { zhHantChat } from './zh-hant_chat'
import { zhHantChrome } from './zh-hant_chrome'
import { zhHantCommandCenter } from './zh-hant_command_center'
import { zhHantCommon } from './zh-hant_common'
import { zhHantConnectors } from './zh-hant_connectors'
import { zhHantDiagnostics } from './zh-hant_diagnostics'
import { zhHantSettings } from './zh-hant_settings'

export const zhHantOverrides = {
  agentCards: zhHantBrain.agentCards,
  inlineWidget: zhHantBrain.inlineWidget,
  skillDeepLink: {
    installTitle: (name: string) => `安裝「${name}」？`,
    installDescription: '此技能將於新的工作階段中可用。請僅安裝可信來源的內容。',
    installTo: '安裝至',
    thisComputer: '這部電腦',
    installing: '正在安裝…',
    installComplete: (name: string) => `已安裝「${name}」`,
    destinationChanged: '安裝目標已變更。請關閉此對話框並重新開啟安裝連結。',
    installed: '已安裝',
    source: '來源'
  },
  externalOpenFailed: {
    title: '無法開啟此連結',
    message: '沒有註冊用於開啟此位址的瀏覽器。請複製連結並手動開啟。',
    copyUrl: '複製連結',
    close: '關閉'
  },
  sharedMetrics: {
    consentTitle: '分享使用統計？',
    dialogTitle: '使用統計',
    consentBody:
      'Brain 可以統計你的使用方式：工作階段長度、執行了哪些模型和工具，以及何時發生失敗。它絕不記錄你的訊息、檔案、路徑或錯誤文字。',
    whatIsCollected: '統計哪些內容',
    collectedActivity: '工作階段：長度、結果、錯誤類型、每日活躍時間',
    collectedModels: '模型：使用哪些模型、token 總量',
    collectedNames: '功能：使用或關閉的內建工具、指令、應用程式區域和設定',
    collectedMilestones: '設定：完成了哪些步驟、提供方連線、技能、外掛和排程工作的數量',
    collectedReliability: '應用程式健康狀態：當機、啟動與回覆速度、更新、訊息平台連線',
    collectedUsage: '代理品質：未成功的編輯、損壞的工具呼叫、卡住的迴圈、每個任務的成本',
    collectedMachine: '機器：作業系統、記憶體範圍、GPU 類型、Brain 版本、本機模型使用情況',
    sending:
      '除非你選擇分享，否則統計資料只會保留在這台電腦上。分享的統計資料每天傳送給 Nous 一次，並附帶此設定檔的隨機 ID。除了一則 Brain 已安裝的一次性記錄（僅在你同意後計入）之外，你同意之前的統計資料永遠不會被傳送。你可以隨時在設定中變更。',
    readDocs: '查看完整說明',
    share: '與 Nous 分享',
    local: '保留在這部電腦上',
    off: '不用了',
    saveFailed: '無法儲存你的選擇',
    collectLabel: '收集使用統計',
    collectDesc: '僅限計數，保留在這部電腦上。絕不包含你的訊息、檔案、路徑或錯誤文字。',
    sendLabel: '與 Nous 分享使用統計',
    sendDesc:
      '每天一次將統計資料連同此設定檔的隨機 ID 傳送給 Nous。除一次性的安裝記錄外，你同意之前的統計資料絕不會被傳送。需要先開啟收集。',
    unavailable: '請更新 Brain 後端以變更此設定。',
    stripBody: '僅限計數，絕不包含你的訊息或檔案。',
    stripReaskBody: '再次詢問：舊版本可能在你看到此問題之前就已儲存了「不用了」。',
    stripChoices: { share: '與 Nous 分享', local: '保留在這部電腦上', off: '不用了' },
    stripDetails: '詳細資訊'
  },
  intro: introZhHant,
  sessionImport: zhHantConnectors.sessionImport,
  common: zhHantCommon.common,
  fileMenu: zhHantChrome.fileMenu,
  boot: zhHantBoot.boot,
  notifications: zhHantDiagnostics.notifications,
  remoteDisplayBanner: zhHantBoot.remoteDisplayBanner,
  butterbar: zhHantBoot.butterbar,
  billingBlock: zhHantCommon.billingBlock,
  sendDiagnostics: zhHantDiagnostics.sendDiagnostics,
  titlebar: { ...zhHantChrome.titlebar, ...zhHantBrain.titlebar },
  language: zhHantSettings.language,
  settings: {
    ...zhHantSettings.settings,
    ...zhHantBrain.settings,
    appearance: { ...zhHantSettings.settings.appearance, ...zhHantBrain.settings.appearance },
    nav: { ...zhHantSettings.settings.nav, ...zhHantBrain.settings.nav }
  },
  skills: zhHantCapabilities.skills,
  starmap: zhHantCapabilities.starmap,
  agents: zhHantCapabilities.agents,
  commandCenter: zhHantCommandCenter.commandCenter,
  messaging: zhHantCommandCenter.messaging,
  profiles: { ...zhHantCommandCenter.profiles, ...zhHantBrain.profiles },
  modelAssignment: {
    saveFailed: 'Brain 未儲存該模型變更。',
    confirmTitle: '模型選擇警告',
    confirmDetail: '僅在你接受此權衡時確認。',
    confirmAction: '確認',
    declined: '已取消模型變更 — 你拒絕了資料訓練層級警告。'
  },
  cron: zhHantCommandCenter.cron,
  artifacts: zhHantArtifacts.artifacts,
  artifactCard: zhHantArtifacts.artifactCard,
  artifactPreview: zhHantArtifacts.artifactPreview,
  sidebar: { ...zhHantChrome.sidebar, ...zhHantBrain.sidebar },
  composer: zhHantChat.composer,
  statusStack: zhHantChat.statusStack,
  updates: zhHantBoot.updates,
  install: zhHantBoot.install,
  onboarding: zhHantBoot.onboarding,
  modelPicker: zhHantSettings.modelPicker,
  modelVisibility: zhHantSettings.modelVisibility,
  shell: {
    ...zhHantChrome.shell,
    ...zhHantBrain.shell,
    modelOptions: { ...zhHantChrome.shell.modelOptions, ...zhHantBrain.shell.modelOptions }
  },
  rightSidebar: zhHantChrome.rightSidebar,
  preview: zhHantArtifacts.preview,
  interfaceMode: {
    title: '介面模式',
    hint: '只改變顯示的內容，不改變 Brain 的能力。',
    sessionNote: '由簡潔模式設定。此處的變更僅在本次工作階段內生效；切換到進階模式即可保留為你的設定。',
    simple: {
      label: '簡潔',
      description: '用於與 Brain 對話。只有側邊欄和聊天；沒有終端機、檔案或差異面板。'
    },
    advanced: {
      label: '進階',
      description: '面向開發者。終端機、檔案、差異、狀態列和版面配置，按你的設定顯示。'
    }
  },
  zones: zhHantChrome.zones,
  contextMenu: zhHantChrome.contextMenu,
  assistant: {
    ...zhHantAssistant.assistant,
    ...zhHantBrain.assistant,
    approval: { ...zhHantAssistant.assistant.approval, ...zhHantBrain.assistant.approval },
    clarify: { ...zhHantAssistant.assistant.clarify, ...zhHantBrain.assistant.clarify }
  },
  prompts: zhHantChat.prompts,
  desktop: zhHantChat.desktop,
  errors: zhHantDiagnostics.errors,
  tips: zhHantChat.tips,
  ui: zhHantCommon.ui,
  handoffTour: {
    profileTitle: '你的第一個任務在預設設定檔中執行',

    profileText:
      '這條欄用來切換設定檔。現在亮著的是 default，任務工作階段就在這裡。另一個是設定用的設定檔，歡迎聊天在那裡。',

    sessionsTitle: '每個設定檔都有自己的工作階段',

    sessionsText:
      '這個清單屬於 default 設定檔。「新工作階段」會在目前選取的設定檔中開始。在欄上切換設定檔，清單也會跟著改變。',

    stayTitle: 'Brain 一鍵可及',

    stayText: '需要幫忙時，切換到設定用的設定檔並開啟「歡迎使用 Brain」。它會一直在那裡。',
    localTitle: '這台電腦可以在本機執行模型',
    localText: (model: string) =>
      `${model} 適合你的硬體。免費執行，對話不會離開你的電腦。隨時在這裡的模型選單中選擇它。`
  },
  freeTier: {
    offer: {
      heading: '繼續使用 Brain',
      body: '你正在使用免費額度。繼續使用 Brain 的話，你會開始遇到限制。登入免費的 Nous 帳戶，即可獲得更多額度。',
      signIn: '登入',
      notNow: '暫不'
    }
  },
  library: {
    title: '資料庫',
    newPage: '新增頁面',
    newTable: '表格',
    untitledTable: '未命名表格',
    export: {
      title: '匯出',
      formats: {
        bundle: '全部 (ZIP)',
        csv: 'CSV',
        docx: 'Word (.docx)',
        html: '網頁 (HTML)',
        images: '投影片圖片 (PNG 的 ZIP)',
        jpeg: 'JPEG 圖片',
        json: 'JSON',
        markdown: 'Markdown (.md)',
        original: '原始檔案',
        pdf: 'PDF 文件',
        png: 'PNG 圖片',
        pptx: 'PowerPoint (.pptx)',
        tsv: 'TSV（定位字元分隔）',
        webp: 'WebP 圖片',
        xlsx: 'Excel (.xlsx)',
        zip: 'ZIP 壓縮檔'
      },
      preparing: '正在準備壓縮檔…',
      tooMany: '該資料夾內容過多，無法一次匯出。',
      tooLarge: '該資料夾過大，無法一次匯出（超過 400 MB）。'
    },
    moreViews: (n: number) => `另外 ${n} 個…`,
    untitled: '未命名',
    searchPlaceholder: '搜尋資料庫',
    upload: '上傳',
    nav: {
      chats: '來自聊天',
      all: '全部',
      pages: '頁面',
      images: '圖片',
      files: '檔案',
      generated: '產生內容',
      favorites: '我的最愛',
      recents: '最近',
      trash: '垃圾桶'
    },
    templates: {
      blank: '空白頁面',
      meeting: '會議記錄',
      todo: '待辦清單',
      project: '專案簡介',
      journal: '日記',
      spec: '產品規格',
      decision: '決策紀錄',
      okr: '目標與 OKR',
      thesis: '投資論點',
      hints: {
        blank: '從空白頁面開始',
        meeting: '議程、決定和有負責人的行動項目',
        todo: '優先事項、本週計畫和等待事項',
        project: '目標、範圍、時程、風險和負責人',
        journal: '今日意圖、行程和晚間回顧',
        spec: '問題、使用者、需求和發布',
        decision: '背景、方案比較、決定及原因',
        okr: '目標、可衡量的關鍵成果和檢查',
        thesis: '論點、催化劑、估值、風險和計畫'
      }
    },
    columns: {
      name: '名稱',
      access: 'Brain 存取權限',
      updated: '最後編輯'
    },
    access: {
      label: 'Brain 存取權限',
      private: '私人',
      ask: '先問我',
      open: '開放',
      privateHint: 'Brain 看不到它',
      askHint: 'Brain 閱讀前會先問你',
      openHint: 'Brain 隨時可以搜尋和閱讀'
    },
    types: {
      folder: '資料夾',
      page: '頁面',
      image: '圖片',
      video: '影片',
      audio: '音訊',
      pdf: 'PDF',
      document: '文件',
      email: '郵件',
      font: '字體',
      spreadsheet: '試算表',
      presentation: '簡報',
      code: '程式碼',
      web: '網頁',
      archive: '壓縮檔',
      file: '檔案'
    },
    actions: {
      favorite: '加入我的最愛',
      unfavorite: '從我的最愛移除',
      exportHtml: '匯出為 HTML',
      exportPdf: '匯出為 PDF…',
      exportFailed: '無法匯出此頁面',
      exported: '頁面已匯出',
      trash: '移到垃圾桶',
      restore: '還原',
      purge: '永久刪除',
      emptyTrash: '清空垃圾桶',
      back: '資料庫',
      more: '更多動作',
      download: '在資料夾中顯示'
    },
    createdByHermes: '由 Brain 建立',
    image: {
      edit: '編輯',
      rotateLeft: '向左旋轉',
      rotateRight: '向右旋轉',
      flipH: '水平翻轉',
      flipV: '垂直翻轉',
      free: '自由',
      original: '原始比例',
      removeBg: '移除背景',
      cancel: '取消',
      save: '儲存',
      saveCopy: '儲存副本',
      copySuffix: '(已編輯)',
      copyMade: '編輯後的副本已儲存到資料庫',
      removeBgPrompt: (name: string) =>
        `移除這張圖片（「${name}」）的背景。保持主體清晰、邊緣乾淨，並將結果儲存為透明背景的 PNG。然後用 library 工具把它加入我的資料庫（動作「import」，檔案的絕對路徑，標題「${name} — 無背景.png」）。`
    },
    deck: {
      export: '匯出',
      exportPptx: 'PowerPoint (.pptx)',
      new: '簡報',
      untitled: '未命名簡報',
      newSlideTitle: '新投影片',
      theme: '主題',
      themes: { paper: '紙張', ink: '墨色', sand: '沙色', ocean: '海洋' },
      count: (n: number) => `${n} 張`,
      exportPdf: '匯出 PDF',
      present: '簡報',
      slide: (n: number) => `第 ${n} 張`,
      duplicate: '複製',
      remove: '刪除',
      addSlide: '新增投影片',
      hint: '點擊任意文字即可編輯。將游標移到區塊上，用 + 新增、移動或刪除；在空區塊中按 /。',
      canvasEmpty: '點擊以加入標題',
      addBlock: '新增區塊',
      blockHeading: '標題',
      blockText: '文字',
      blockBullets: '項目清單',
      blockNumbered: '編號清單',
      blockQuote: '引用',
      blockCode: '程式碼',
      blockImage: '圖片…',
      moveUp: '上移',
      moveDown: '下移',
      removeBlock: '刪除區塊',
      typeHere: '輸入文字，或按 / 選擇區塊',
      pickImage: '新增圖片',
      starter: { subtitle: '一句簡短的副標題', agenda: '議程', body: '加入你的重點' }
    },
    table: {
      undo: '復原',
      redo: '重做',
      saveFailed: '無法儲存',
      filter: '篩選列…',
      analyze: '用 Brain 分析',
      newRow: '新增列',
      newColumn: '新增欄',
      sortAsc: '遞增排序',
      sortDesc: '遞減排序',
      clearSort: '清除排序',
      rename: '重新命名',
      insertLeft: '在左側插入欄',
      insertRight: '在右側插入欄',
      deleteColumn: '刪除欄',
      insertAbove: '在上方插入列',
      insertBelow: '在下方插入列',
      deleteRow: '刪除列',
      editCopy: '編輯副本',
      copyMade: '可編輯的副本已儲存到資料庫',
      rows: (n: number) => `${n.toLocaleString()} 列`,
      filtered: (shown: number, total: number) => `${shown.toLocaleString()} / ${total.toLocaleString()} 列`,
      analyzePrompt: (name: string) =>
        `分析表格「${name}」：內容為何、關鍵數字與趨勢，以及任何異常之處。如果圖表有幫助，請在資料庫頁面中加入一個。`,
      newColumnName: (letter: string) => `欄 ${letter}`,
      columnMenu: (name: string) => `${name} 欄選項`,
      rowMenu: (n: number) => `第 ${n} 列選項`
    },
    chats: {
      emptyTitle: '還沒有來自聊天的內容',
      emptyBody: 'Brain 在對話中建立或編輯的頁面與區塊會匯集在這裡，每個聊天一張卡片。',
      openChat: '開啟聊天',
      untitledChat: '對話',
      summary: (n: number, when: string) => `${n} 項 · ${when}`
    },
    create: {
      button: '用 Brain 建立',
      title: '用 Brain 建立',
      subtitle: '描述你需要的內容。Brain 會在你眼前把它寫進新頁面，並在儲存前徵求你的同意。',
      kindLabel: '要建立什麼',
      kinds: {
        deck: '投影片',
        document: '文件',
        plan: '計畫',
        research: '研究',
        interactive: '互動'
      },
      placeholders: {
        deck: '一份介紹……的簡報',
        document: '一頁關於……的簡報',
        plan: '一個……的計畫',
        research: '關於……我需要知道什麼',
        interactive: '一個能……的小工具'
      },
      examples: {
        deck: ['新產品的 6 頁推介', '本季團隊進度報告'],
        document: ['我們新網站的專案簡報', '每週會議的筆記範本'],
        plan: ['一款 App 的 4 週上線計畫', '30 天學西班牙文的計畫'],
        research: ['比較適合小團隊的 3 款 CRM 工具', '今年電動車的主要趨勢'],
        interactive: ['含月付金額的貸款計算機', '一週習慣追蹤表']
      },
      consentHint: 'Brain 在儲存任何內容到頁面前都會先詢問你。',
      cancel: '取消',
      create: '建立',
      kindHints: {
        deck: 'Make it a presentation: a Library page whose text starts with the single line `<!-- hermes:deck theme=paper -->` (themes: paper, ink, sand, ocean) and holds one slide per section, sections separated by a line containing only `---`. First slide: `# Title` plus one subtitle line. The others: `## Heading` with 3–5 short bullets (`- `), or a short quote (`> `). Give the page the icon 🎞️. Keep every slide readable at a glance.',
        document: '',
        plan: '寫成計畫：目標、含負責人與日期的步驟、風險。',
        research: '先做研究（能搜尋網頁就搜尋），再寫一份清楚、附來源的摘要。',
        interactive: '做成頁面上的互動區塊——一個能用的小工具，而不只是文字。'
      },
      fromTemplate: '從範本',
      instruction: (title: string, id: string) =>
        `用 library 工具把這些寫進我的資料庫頁面「${title}」（id ${id}）：整頁用 markdown，並取一個合適的標題。`
    },
    withHermes: {
      open: 'Brain',
      openTip: '與 Brain 並排一起處理',
      allowTitle: '讓 Brain 處理這個項目嗎？',
      allowBody:
        '這是私人項目，Brain 目前看不到。允許後，Brain 每次讀取或修改前都會先詢問你。你可以隨時在「存取」中更改。',
      allow: '允許',
      notNow: '稍後',
      edited: 'Brain 編輯了此頁面',
      viewChanges: '查看變更',
      undo: '復原',
      undone: '已復原 Brain 的變更',
      dismiss: '關閉',
      changesTitle: 'Brain 的變更',
      noChanges: '只有格式有變更。',
      undoFailed: '無法復原變更',
      keptYours: 'Brain 修改了你也在編輯的內容，已保留你的版本。',
      openFull: '以完整聊天開啟',
      closeChat: '關閉聊天'
    },
    pageLook: {
      addIcon: '新增圖示',
      addCover: '新增封面',
      changeIcon: '更換圖示',
      removeIcon: '移除',
      changeCover: '更換封面',
      reposition: '調整位置',
      savePosition: '儲存位置',
      cancel: '取消',
      removeCover: '移除',
      gallery: '圖庫',
      fromLibrary: '資料庫',
      upload: '上傳',
      uploadAction: '選擇圖片…',
      uploadHint: 'JPG、PNG、WebP 或 GIF，會儲存在此頁面下。',
      noImages: '資料庫中還沒有圖片。',
      dragHint: '拖曳圖片以調整位置'
    },
    saving: '正在儲存…',
    saved: '已儲存',
    view: {
      list: '清單檢視',
      grid: '格狀檢視'
    },
    errors: {
      load: '無法載入資料庫',
      save: '無法儲存頁面',
      upload: '無法上傳檔案'
    },
    emptyTrashConfirm: {
      title: '清空垃圾桶？',
      description: '垃圾桶中的所有內容都會被永久刪除。此動作無法復原。',
      confirm: '清空垃圾桶'
    },
    workspace: {
      new: '新增',
      newFolder: '新增資料夾',
      uploadFiles: '上傳檔案…',
      uploadFolder: '上傳資料夾…',
      untitledFolder: '未命名資料夾',
      items: (n: number) => `${n} 個項目`,
      inFolder: (name: string) => `位於 ${name}`,
      rename: '重新命名',
      moveTo: '移至…',
      open: '開啟',
      dropUpload: '拖放即可上傳',
      dropInto: (name: string) => `拖放至 ${name}`,
      folderEmptyTitle: '此資料夾是空的',
      folderEmptyBody: '將檔案拖到這裡，或新增頁面或資料夾。',
      sort: {
        label: '排序',
        updated: '最後編輯',
        created: '建立日期',
        name: '名稱',
        size: '大小',
        kind: '類型',
        asc: '遞增',
        desc: '遞減'
      },
      sortAndFilter: '排序與篩選',
      filter: {
        label: '篩選',
        type: '類型',
        access: 'Brain 存取權',
        createdBy: '建立者',
        you: '你',
        hermes: 'Brain',
        clear: '清除篩選',
        active: (n: number) => `${n} 個篩選`
      },
      selection: {
        count: (n: number) => `已選取 ${n} 項`,
        selectAll: '全選',
        clear: '取消選取',
        select: '選取'
      },
      move: {
        title: (n: number) => `移動 ${n} 個項目`,
        here: '移到這裡',
        moved: (place: string) => `已移至 ${place}`
      },
      uploads: {
        title: '上傳',
        active: (n: number) => `正在上傳 ${n} 個項目`,
        done: (n: number) => `已完成 ${n} 個上傳`,
        copying: '正在複製…',
        waiting: '等待中…',
        ready: '完成',
        failed: '失敗',
        retry: '重試',
        cancel: '取消',
        cancelled: '已取消',
        skipped: '已略過',
        files: (n: number) => `${n} 個檔案`,
        dismiss: '關閉',
        collapse: '收合',
        expand: '展開'
      },
      duplicate: {
        nameTitle: '名稱已被使用',
        contentTitle: '資料庫中已有此檔案',
        nameBody: (name: string, place: string) => `「${name}」已在 ${place} 中。`,
        contentBody: (name: string, existing: string) => `「${name}」與「${existing}」內容相同。`,
        replace: '取代',
        keepBoth: '兩者都保留',
        skip: '略過',
        applyToAll: (n: number) => `對接下來的 ${n} 個項目執行相同操作`
      },
      errors: {
        move: '無法移動這些項目',
        folder: '無法建立資料夾',
        rename: '無法重新命名'
      }
    },
    chat: {
      fromLibrary: '從資料庫…',
      pickerTitle: '從資料庫附加',
      pickerSearch: '搜尋頁面和檔案…',
      attach: '附加',
      noResults: '找不到內容',
      saveToLibrary: '存入資料庫',
      savedToLibrary: '已存入資料庫',
      addedToPage: page => `已加入「${page}」`,
      open: '打開',
      askHermes: '詢問 Brain',
      attachFailed: '無法從資料庫附加'
    },
    organize: {
      tags: '標籤',
      tag: '標籤',
      newTag: '新標籤…',
      manageTags: '管理標籤…',
      tagName: '標籤名稱',
      create: '建立',
      deleteTag: '刪除標籤',
      noTags: '還沒有標籤。',
      saveSearch: '儲存搜尋',
      saveSearchTitle: '儲存此搜尋',
      searchName: '名稱',
      removeSearch: '移除已儲存的搜尋',
      versionHistory: '版本記錄…',
      noVersions: '還沒有較早的版本。取代檔案或編輯頁面時會在此保留一個版本。',
      restore: '回復',
      restored: '已回復版本',
      restoreConfirm: '目前狀態也會保留為一個版本，因此可以還原。',
      fileVersion: '檔案版本',
      colors: {
        red: '紅色',
        orange: '橙色',
        yellow: '黃色',
        green: '綠色',
        blue: '藍色',
        purple: '紫色',
        gray: '灰色'
      }
    },
    explorer: {
      details: '詳細資訊',
      duplicate: '製作副本',
      copy: '拷貝',
      cut: '剪下',
      paste: '貼上',
      copyPath: '拷貝路徑',
      info: '資訊',
      infoEmpty: '選擇一項以查看詳細資料。',
      kind: '種類',
      size: '大小',
      dimensions: '尺寸',
      pages: '頁數',
      created: '建立時間',
      modified: '修改時間',
      createdBy: '建立者',
      location: '位置',
      you: '你',
      hermes: 'Brain',
      contents: '內容',
      dragOutHint: '拖移時按住 ⌥ 可將檔案拷貝到 Finder 或其他 App。',
      position: (n: number, total: number) => `第 ${n} 項，共 ${total} 項`,
      selection: (n: number, size: string) => (size ? `${n} 項 · ${size}` : `${n} 項`)
    },
    editor: {
      page: '頁面',
      pageHint: '在此頁面中嵌入子頁面',
      todo: '待辦清單',
      todoHint: '用待辦清單追蹤任務',
      deletedPage: '已刪除的頁面',
      interactive: '互動區塊',
      interactiveHint: '計算機、測驗或圖表——任何 HTML，直接在頁面中執行',
      interactivePaste: '描述要建立的內容，或在此貼上 HTML…',
      interactiveAdd: '新增區塊',
      interactiveUpload: '上傳 .html 檔案',
      interactiveExpand: '全螢幕',
      interactiveCollapse: '結束全螢幕',
      interactiveFailed: '無法載入此區塊',
      interactiveTooLarge: '文件對區塊而言太大（最多 1.5 MB）',
      interactiveBuild: '用 Brain 建立',
      interactiveBuilding: 'Brain 正在建立此區塊…',
      interactiveCancel: '取消',
      interactiveAsk: '請 Brain 修改',
      interactiveAskPlaceholder: '要改什麼？',
      interactiveSend: '傳送',
      interactiveData: size => `已儲存的資料 · ${size}`,
      interactiveResetData: '重設已儲存的資料',
      interactiveNetworkAsk: hosts => `此區塊想要連線到 ${hosts}`,
      interactiveNetworkAllow: '允許',
      interactiveNetworkLater: '暫不',
      interactiveNetworkOn: hosts => `網際網路存取 · ${hosts}`,
      interactiveNetworkRevoke: '撤銷',
      interactiveNetworkInvalid: hosts => `已略過（不是公開的 https 主機）：${hosts}`,
      interactiveTemplates: '或從範本開始',
      htmlDropTitle: name => `新增「${name}」`,
      htmlDropBody: '作為互動區塊執行，或匯入其文字與格式。',
      htmlDropText: '作為文字',
      interactiveTemplate: {
        roi: '投資報酬率計算機',
        quiz: '測驗',
        flashcards: '記憶卡片',
        kpi: 'KPI 儀表板',
        chart: '圖表',
        timeline: '時間軸',
        kanban: '看板',
        focus: '專注計時器',
        invoice: '發票',
        budget: '月預算',
        decision: '決策矩陣',
        currency: '貨幣換算'
      }
    },
    preview: {
      extract: '解壓縮',
      from: '寄件者',
      to: '收件者',
      cc: '副本',
      videoConverterMissing: '安裝 ffmpeg 後即可在此播放此格式的影片。',
      downloadFfmpeg: '下載 ffmpeg',
      fontSample: '輸入文字以預覽字體…',
      extracted: (name: string) => `已解壓縮到「${name}」`,
      attachments: (n: number) => `${n} 個附件`,
      loadingPercent: (n: number) => `正在載入… ${n}%`,
      openFailed: '無法在此開啟此檔案。',
      tryAgain: '重試',
      openInApp: '在應用程式中開啟',
      downloadLibreOffice: '下載 LibreOffice',
      checkAgain: '重新檢查',
      processing: '正在處理…',
      zoomIn: '放大',
      zoomOut: '縮小',
      fit: '符合視窗',
      actualSize: '實際大小',
      fullscreen: '全螢幕',
      exitFullscreen: '結束全螢幕',
      edit: '編輯',
      editCode: '編輯程式碼',
      save: '儲存',
      saving: '正在儲存…',
      unsaved: '有未儲存的變更',
      discard: '捨棄',
      play: '播放',
      pause: '暫停',
      noPreviewBody: '在資料夾中顯示，以便用其他應用程式開啟。',
      converterMissing: '安裝 LibreOffice 即可依原樣檢視此文件。目前顯示其文字。',
      converterMissingShort: '安裝 LibreOffice 即可在此預覽此文件。',
      truncated: '僅顯示此檔案的開頭部分。',
      rows: (n: number) => `${n} 列`,
      entries: (n: number) => `${n} 個項目`,
      pages: (n: number) => `${n} 頁`
    },
    consent: {
      eyebrow: '資料庫',
      actions: {
        read: 'Brain 想閱讀一個頁面',
        search: 'Brain 想搜尋你的資料庫',
        create: 'Brain 想建立一個頁面',
        update: 'Brain 想編輯一個頁面',
        delete: 'Brain 想把一個項目移到垃圾桶',
        attach: 'Brain 想附加一個檔案'
      },
      why: '原因',
      changes: '將會變更',
      preview: '預覽',
      query: '搜尋內容',
      approve: '允許',
      decline: '拒絕',
      footnote: '在你決定之前什麼都不會發生。',
      expired: '此請求已不再有效。'
    },
    empty: {
      allTitle: '資料庫是空的',
      allBody: '新增一個頁面，或拖入圖片、影片、PDF 和文件。',
      trashTitle: '垃圾桶是空的',
      trashBody: '刪除的頁面和檔案會留在這裡，直到你清空垃圾桶。',
      search: (query: string) => `沒有與「${query}」相符的內容。`
    },
    edited: (when: string) => `編輯於 ${when}`,
    purgeConfirm: {
      title: '永久刪除？',
      confirm: '永久刪除',
      description: (title: string) => `「${title}」及其中儲存的所有內容都會被刪除。此動作無法復原。`
    }
  },
  notificationFeed: {
    unread: count => `${count} 則未讀`,
    allRead: '全部已讀',
    markAllRead: '全部標為已讀',
    clear: '全部清除',
    emptyTitle: '尚無通知',
    emptyBody: '背景對話、代理或排程工作完成後，會連同完成的內容顯示在這裡。',
    reply: '已完成',
    error: '因錯誤停止',
    approval: '等待你的核准',
    question: '等待你的回答',
    agent: '代理已完成',
    agentFailed: '代理失敗',
    scheduled: '排程工作已執行',
    process: '指令已完成',
    processFailed: '指令失敗',
    plugin: '通知',
    filesWritten: count => `寫入了 ${count} 個檔案`
  },
  introGreeting: {
    morning: '早安',
    afternoon: '午安',
    evening: '晚上好'
  }
} satisfies TranslationOverrides

export const zhHant = defineLocale(zhHantOverrides)
