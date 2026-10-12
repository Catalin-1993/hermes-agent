import type { LibraryItem } from './data'

/** What a Library file is, for icons, tints, filters and (next) the previewer it opens in. */
export type LibraryFileCategory =
  | 'archive'
  | 'audio'
  | 'code'
  | 'document'
  | 'email'
  | 'file'
  | 'font'
  | 'image'
  | 'pdf'
  | 'presentation'
  | 'spreadsheet'
  | 'video'
  | 'web'

export type LibraryItemType = 'folder' | 'page' | LibraryFileCategory

// ONE table: a new format is one row here. Extensions win over MIME (uploads often arrive as
// application/octet-stream); MIME is the fallback for names without a known extension.
const EXTENSIONS: Record<LibraryFileCategory, readonly string[]> = {
  archive: ['zip', 'tar', 'gz', 'tgz', 'tbz2', 'txz', 'rar', '7z', 'bz2', 'xz', 'iso'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'aiff'],
  code: [
    'js',
    'mjs',
    'cjs',
    'ts',
    'tsx',
    'jsx',
    'json',
    'xml',
    'yaml',
    'yml',
    'toml',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'kt',
    'swift',
    'c',
    'h',
    'cpp',
    'cs',
    'php',
    'sh',
    'sql',
    'ipynb'
  ],
  document: ['doc', 'docx', 'txt', 'rtf', 'md', 'markdown', 'odt', 'pages', 'epub', 'log'],
  email: ['eml', 'msg'],
  file: [],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  image: [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'svg',
    'heic',
    'heif',
    'avif',
    'bmp',
    'tif',
    'tiff',
    'ico',
    'raw',
    'cr2',
    'cr3',
    'nef',
    'arw',
    'dng',
    'orf',
    'rw2'
  ],
  pdf: ['pdf'],
  presentation: ['ppt', 'pptx', 'odp', 'key'],
  spreadsheet: ['xls', 'xlsx', 'csv', 'tsv', 'ods', 'numbers'],
  video: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpeg', 'mpg', 'wmv', 'flv', '3gp'],
  web: ['html', 'htm', 'css', 'scss']
}

const BY_EXTENSION = new Map<string, LibraryFileCategory>(
  (Object.entries(EXTENSIONS) as [LibraryFileCategory, readonly string[]][]).flatMap(([category, list]) =>
    list.map(ext => [ext, category] as const)
  )
)

function categoryFromMime(mime: string): LibraryFileCategory {
  if (mime === 'application/pdf') {
    return 'pdf'
  }

  const [top] = mime.split('/')

  if (top === 'image' || top === 'video' || top === 'audio') {
    return top
  }

  if (mime === 'text/html') {
    return 'web'
  }

  if (/json|xml|javascript|typescript/.test(mime)) {
    return 'code'
  }

  if (/zip|compressed|tar|rar/.test(mime)) {
    return 'archive'
  }

  if (/spreadsheet|excel|csv/.test(mime)) {
    return 'spreadsheet'
  }

  if (/presentation|powerpoint/.test(mime)) {
    return 'presentation'
  }

  return top === 'text' || /word|rtf|opendocument\.text/.test(mime) ? 'document' : 'file'
}

/** Lower-case extension without the dot, or ''. */
export function extensionOf(name: null | string | undefined): string {
  const match = /\.([a-z0-9]{1,10})$/i.exec(name ?? '')

  return match ? match[1].toLowerCase() : ''
}

export function fileCategoryOf(item: Pick<LibraryItem, 'file_name' | 'mime'>): LibraryFileCategory {
  return BY_EXTENSION.get(extensionOf(item.file_name)) ?? categoryFromMime(item.mime ?? '')
}

export function itemTypeOf(item: Pick<LibraryItem, 'file_name' | 'kind' | 'mime'>): LibraryItemType {
  return item.kind === 'file' ? fileCategoryOf(item) : item.kind
}

export const ITEM_TYPE_ICON: Record<LibraryItemType, string> = {
  archive: 'file-zip',
  audio: 'unmute',
  code: 'file-code',
  document: 'file-text',
  email: 'mail',
  file: 'file',
  font: 'text-size',
  folder: 'folder',
  image: 'file-media',
  page: 'note',
  pdf: 'file-pdf',
  presentation: 'preview',
  spreadsheet: 'table',
  video: 'device-camera-video',
  web: 'globe'
}

/** The type's accent — a quiet tint behind its glyph, never a fill. */
export const ITEM_TYPE_TINT: Record<LibraryItemType, string> = {
  archive: '#a16207',
  audio: '#db2777',
  code: '#475569',
  document: '#2563eb',
  email: '#0284c7',
  file: '#64748b',
  font: '#9333ea',
  folder: '#3b82f6',
  image: '#0d9488',
  page: '#64748b',
  pdf: '#dc2626',
  presentation: '#ea580c',
  spreadsheet: '#16a34a',
  video: '#7c3aed',
  web: '#0891b2'
}

/** Filter order: the types a person reaches for first. */
export const FILTER_TYPES: readonly LibraryItemType[] = [
  'folder',
  'page',
  'image',
  'video',
  'audio',
  'pdf',
  'document',
  'spreadsheet',
  'presentation',
  'code',
  'web',
  'email',
  'font',
  'archive',
  'file'
]
