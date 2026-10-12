import type { TranslationOverrides } from './define-locale'

/** Brain's own copy for this locale (Library cards, inline widgets, profile menu, sidebar), kept beside the
 *  community's section files so a sync from upstream never drops it. Merged into the overlay in ar.ts. */
export const arBrain = {
  agentCards: {
    addToCalendar: 'أضف إلى التقويم',
    allDay: 'طوال اليوم',
    askAbout: 'اعرف المزيد',
    askAboutPrompt: name => `أخبرني المزيد عن ${name}.`,
    buy: 'شراء',
    buyPrompt: (name, merchant) => `أود شراء ${name}${merchant ? ` من ${merchant}` : ''}. أرشدني قبل تقديم أي طلب.`,
    closed: 'مغلق',
    directions: 'الاتجاهات',
    open: 'مفتوح',
    openOnYouTube: 'فتح على YouTube',
    places: n => `${n} أماكن`,
    playVideo: title => `تشغيل ${title}`,
    reviews: n => `${n.toLocaleString()} مراجعة`,
    videoUntitled: 'فيديو YouTube',
    view: 'عرض',
    views: count => `${count} مشاهدة`,
    website: 'الموقع'
  },
  assistant: {
    approval: {
      title: 'تشغيل هذا الأمر؟',
      titleAction: 'السماح بهذا الإجراء؟'
    },
    clarify: {
      cardTitle: count => (count === 1 ? 'لدى Brain سؤال' : 'لدى Brain بعض الأسئلة')
    }
  },
  inlineWidget: {
    addToPage: 'إضافة إلى صفحة',
    networkAllow: 'سماح',
    networkAsk: hosts => `يريد هذا الودجت الاتصال بـ ${hosts}`,
    networkLater: 'ليس الآن',
    networkOn: hosts => `الوصول إلى الإنترنت · ${hosts}`,
    networkRevoke: 'إلغاء',
    pickerEmpty: 'لا توجد صفحات',
    pickerNew: 'صفحة جديدة',
    pickerSearch: 'ابحث عن صفحة…',
    title: 'ودجت'
  },
  profiles: {
    changeName: 'تغيير الاسم…',
    changePhoto: 'تغيير الصورة…',
    editProfile: 'تعديل الملف',
    personalization: 'التخصيص',
    removePhoto: 'إزالة الصورة'
  },
  settings: {
    appearance: {
      flipPanesDesc: 'يضع شريط الجلسات الجانبي على اليمين ومتصفح الملفات على اليسار.',
      flipPanesTitle: 'تبديل جانبي الأشرطة'
    },
    nav: {
      messaging: 'المراسلة'
    }
  },
  shell: {
    modelOptions: {
      off: 'إيقاف'
    }
  },
  sidebar: {
    navEdit: 'تعديل',
    navEditTitle: 'إظهار في الشريط الجانبي',
    navMore: 'المزيد',
    notifications: 'الإشعارات',
    projectName: 'Brain'
  },
  titlebar: {
    back: 'رجوع',
    forward: 'تقدّم',
    modeSwitch: 'وضع الشريط الجانبي',
    unreadNotifications: count => `إشعارات غير مقروءة: ${count}`
  }
} satisfies TranslationOverrides
