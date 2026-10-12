import { strToU8, zipSync } from 'fflate'

import type { Deck, DeckTheme } from './deck'
import { slideLayout } from './deck'
import { type Align, type Block, type ListItem, parseBlocks } from './deck-blocks'
import { parseInline } from './deck-inline'
import { DECK_THEME_STYLE } from './deck-slide'

/** A deck as a PowerPoint file (.pptx): real, editable text boxes in the deck's own colours — not a
 *  picture of each slide. A .pptx is a ZIP of XML parts; this writes the few it needs by hand with the
 *  `fflate` the app already carries, so no new library rides along. */

const SLIDE_W = 12192000
const SLIDE_H = 6858000
/** One hundredth of the slide's width — the unit the canvas is drawn in — in EMU and in points. */
const CQ = SLIDE_W / 100
const PT_PER_CQ = 9.6

export interface PptxImage {
  bytes: Uint8Array
  ext: 'jpeg' | 'png'
  /** Natural size in pixels. */
  h: number
  w: number
}

export type ImageLoader = (src: string) => Promise<null | PptxImage>

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, char => ({ '"': '&quot;', "'": '&apos;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)

const emu = (cqw: number) => Math.round(cqw * CQ)
const size = (cqw: number) => Math.round(cqw * PT_PER_CQ * 100)
const hexes = (css: string) => [...css.matchAll(/#([0-9a-f]{6})/gi)].map(match => match[1].toUpperCase())

interface Palette {
  accent: string
  /** Background: one colour, or two for a diagonal wash. */
  background: string[]
  color: string
  muted: string
}

function palette(theme: DeckTheme): Palette {
  const style = DECK_THEME_STYLE[theme]
  const all = hexes(style.background)

  return {
    accent: hexes(style.accent)[0],
    background: all.length > 1 ? [all[0], all.at(-1)!] : all,
    color: hexes(style.color)[0],
    muted: hexes(style.muted)[0]
  }
}

const fill = (color: string) => `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`

interface RunFormat {
  bold?: boolean
  color: string
  font: string
  italic?: boolean
  size: number
  strike?: boolean
  underline?: boolean
}

const run = (text: string, format: RunFormat) =>
  `<a:r><a:rPr lang="en-US" sz="${format.size}"${format.bold ? ' b="1"' : ''}${format.italic ? ' i="1"' : ''}${
    format.underline ? ' u="sng"' : ''
  }${format.strike ? ' strike="sngStrike"' : ''} dirty="0">${fill(format.color)}<a:latin typeface="${format.font}"/><a:cs typeface="${format.font}"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>`

const FONT = { body: 'Arial', code: 'Courier New', heading: 'Georgia' }

const hexOf = (css: string) => css.replace('#', '').toUpperCase()

/** A block's words as runs, with each span's own font, size, colour and marks carried over. */
function runsOf(text: string, base: RunFormat, accent: string): string {
  const parts = parseInline(text)

  return (parts.length ? parts : [{ text: '' }])
    .map(part =>
      run(part.text, {
        ...base,
        bold: base.bold || part.bold,
        color: part.color ? hexOf(part.color) : part.link ? accent : base.color,
        font: part.font ?? (part.code ? FONT.code : base.font),
        italic: base.italic || part.italic,
        size: part.size ? Math.round(part.size * 100) : base.size,
        strike: part.strike,
        underline: part.underline || Boolean(part.link)
      })
    )
    .join('')
}

interface ParagraphOptions {
  bullet?: string
  indent?: number
  /** Line height as a percentage of single. */
  line?: number
  marginLeft?: number
  /** Points before / after, in hundredths. */
  after?: number
  align?: Align
  before?: number
}

const paragraph = (runs: string, options: ParagraphOptions = {}, accent = '000000') => {
  const { after = 0, align = 'left', before = 0, bullet, indent = 0, line = 120, marginLeft = 0 } = options

  return `<a:p><a:pPr marL="${marginLeft}" indent="${indent}" algn="${align === 'center' ? 'ctr' : align === 'right' ? 'r' : 'l'}"><a:lnSpc><a:spcPct val="${line * 1000}"/></a:lnSpc><a:spcBef><a:spcPts val="${before}"/></a:spcBef><a:spcAft><a:spcPts val="${after}"/></a:spcAft>${
    bullet === undefined
      ? '<a:buNone/>'
      : bullet === 'number'
        ? `<a:buClr><a:srgbClr val="${accent}"/></a:buClr><a:buFont typeface="${FONT.body}"/><a:buAutoNum type="arabicPeriod"/>`
        : `<a:buClr><a:srgbClr val="${accent}"/></a:buClr><a:buFont typeface="${FONT.body}"/><a:buChar char="${bullet}"/>`
  }</a:pPr>${runs}</a:p>`
}

/** A block as PowerPoint paragraphs, sized the way the slide is drawn. */
function paragraphs(block: Block, title: boolean, colors: Palette, first: boolean): string[] {
  const body = { color: colors.color, font: FONT.body, size: size(title ? 2.8 : 2.45) }

  if (block.kind === 'heading') {
    const cqw = title && block.level === 1 ? 8.4 : block.level === 1 ? 5.4 : block.level === 2 ? 4.4 : 3.2

    return [
      paragraph(
        runsOf(
          block.text,
          { bold: !(title && block.level === 1), color: colors.color, font: FONT.heading, size: size(cqw) },
          colors.accent
        ),
        { after: 1800, align: block.align, line: 100 },
        colors.accent
      )
    ]
  }

  if (block.kind === 'paragraph') {
    return [
      paragraph(
        runsOf(block.text, { ...body, color: title ? colors.muted : colors.color }, colors.accent),
        { after: 1200, align: block.align },
        colors.accent
      )
    ]
  }

  if (block.kind === 'quote') {
    return [
      paragraph(
        runsOf(block.text, { ...body, italic: true, size: size(3) }, colors.accent),
        { after: 1200, align: block.align, before: first ? 0 : 1000, indent: 0, marginLeft: emu(2.4) },
        colors.accent
      )
    ]
  }

  if (block.kind === 'code') {
    return block.text
      .split('\n')
      .map(line =>
        paragraph(run(line, { color: colors.color, font: FONT.code, size: size(1.9) }), { line: 110 }, colors.accent)
      )
  }

  if (block.kind === 'list') {
    return block.items.map((item: ListItem) =>
      paragraph(
        runsOf(item.text, { ...body, size: size(item.depth ? 2.15 : 2.45) }, colors.accent),
        {
          align: block.align,
          before: 1000,
          bullet: item.ordered ? 'number' : item.depth ? '–' : '•',
          indent: -emu(2.8),
          marginLeft: emu(item.depth * 3.2 + 2.8)
        },
        colors.accent
      )
    )
  }

  return []
}

interface Placed {
  /** The picture the slide carries, loaded — its bytes go in the package under the slide's `rId2`. */
  picture: null | PptxImage
  xml: string
}

const background = (colors: Palette) =>
  colors.background.length > 1
    ? `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${colors.background[0]}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${colors.background[1]}"/></a:gs></a:gsLst><a:lin ang="2700000" scaled="0"/></a:gradFill>`
    : fill(colors.background[0])

/** One slide: its text in a single vertically-centred box (as the canvas centres it), and — when it has
 *  one — its first picture beside the text. */
async function slideXml(slide: string, theme: DeckTheme, load: ImageLoader): Promise<Placed> {
  const colors = palette(theme)
  const title = slideLayout(slide) === 'title'
  const blocks = parseBlocks(slide)
  const padX = title ? 8 : 7
  const padY = title ? 7 : 6
  const x0 = emu(padX)
  const y0 = emu(padY)
  const innerW = SLIDE_W - 2 * x0
  const innerH = SLIDE_H - 2 * y0
  const firstImage = blocks.find(block => block.kind === 'image')
  const picture = firstImage?.kind === 'image' ? await load(firstImage.src) : null

  const text = blocks
    .filter(block => block.kind !== 'image')
    .flatMap((block, index) => paragraphs(block, title, colors, index === 0))

  const textW = picture && text.length ? Math.round(innerW * 0.54) : innerW
  let shapes = ''
  let id = 2

  if (text.length) {
    shapes += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${textW}" cy="${innerH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/>${text.join('')}</p:txBody></p:sp>`
    id += 1
  }

  if (picture && firstImage?.kind === 'image') {
    const boxW = text.length ? Math.round(innerW * 0.42) : innerW
    const boxH = innerH
    const scale = Math.min(boxW / picture.w, boxH / picture.h)
    const w = Math.round(picture.w * scale)
    const h = Math.round(picture.h * scale)
    const left = text.length ? x0 + Math.round(innerW * 0.58) : x0 + Math.round((innerW - w) / 2)

    shapes += `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}" descr="${escapeXml(firstImage.alt)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${left}" y="${y0 + Math.round((boxH - h) / 2)}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  }

  const xml = `${XML}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:bg><p:bgPr>${background(colors)}<a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`

  return { picture, xml }
}

const rels = (items: { id: string; target: string; type: string }[]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(item => `<Relationship Id="${item.id}" Type="${REL}/${item.type}" Target="${item.target}"/>`)
    .join('')}</Relationships>`

const THEME = `${XML}<a:theme xmlns:a="${NS_A}" name="Brain"><a:themeElements><a:clrScheme name="Brain"><a:dk1><a:srgbClr val="1C1B19"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="3B5BDB"/></a:accent1><a:accent2><a:srgbClr val="B3601D"/></a:accent2><a:accent3><a:srgbClr val="1F5E86"/></a:accent3><a:accent4><a:srgbClr val="6B675F"/></a:accent4><a:accent5><a:srgbClr val="8AB4FF"/></a:accent5><a:accent6><a:srgbClr val="FFD37A"/></a:accent6><a:hlink><a:srgbClr val="3B5BDB"/></a:hlink><a:folHlink><a:srgbClr val="6B675F"/></a:folHlink></a:clrScheme><a:fontScheme name="Brain"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Brain"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`

const EMPTY_TREE =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>'

const MASTER = `${XML}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:defPPr><a:defRPr/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>`

const LAYOUT = `${XML}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`

/** The finished file's bytes. `load` resolves a picture's source (a Library image, a link) to its bytes;
 *  one it cannot load is left out rather than failing the export. */
export async function buildPptx(deck: Deck, title: string, load: ImageLoader): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {}

  const put = (path: string, text: string) => {
    files[path] = strToU8(text)
  }

  const slideEntries: { id: string; n: number }[] = []
  const imageExts = new Set<string>()
  let imageCount = 0

  for (const [index, slide] of deck.slides.entries()) {
    const n = index + 1
    const { picture, xml } = await slideXml(slide, deck.theme, src => load(src).catch(() => null))
    const slideRels = [{ id: 'rId1', target: '../slideLayouts/slideLayout1.xml', type: 'slideLayout' }]

    if (picture) {
      imageCount += 1
      imageExts.add(picture.ext)
      files[`ppt/media/image${imageCount}.${picture.ext}`] = picture.bytes
      slideRels.push({ id: 'rId2', target: `../media/image${imageCount}.${picture.ext}`, type: 'image' })
    }

    put(`ppt/slides/slide${n}.xml`, xml)
    put(`ppt/slides/_rels/slide${n}.xml.rels`, rels(slideRels))
    slideEntries.push({ id: `rId${n + 1}`, n })
  }

  put(
    '[Content_Types].xml',
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[
      ...imageExts
    ]
      .map(ext => `<Default Extension="${ext}" ContentType="image/${ext}"/>`)
      .join(
        ''
      )}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${slideEntries
      .map(
        entry =>
          `<Override PartName="/ppt/slides/slide${entry.n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
      )
      .join('')}</Types>`
  )
  put(
    '_rels/.rels',
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
  )
  put(
    'docProps/core.xml',
    `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Brain</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
  )
  put(
    'ppt/presentation.xml',
    `${XML}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideEntries
      .map(entry => `<p:sldId id="${255 + entry.n}" r:id="${entry.id}"/>`)
      .join(
        ''
      )}</p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
  )
  put(
    'ppt/_rels/presentation.xml.rels',
    rels([
      { id: 'rId1', target: 'slideMasters/slideMaster1.xml', type: 'slideMaster' },
      ...slideEntries.map(entry => ({ id: entry.id, target: `slides/slide${entry.n}.xml`, type: 'slide' }))
    ])
  )
  put('ppt/slideMasters/slideMaster1.xml', MASTER)
  put(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    rels([
      { id: 'rId1', target: '../slideLayouts/slideLayout1.xml', type: 'slideLayout' },
      { id: 'rId2', target: '../theme/theme1.xml', type: 'theme' }
    ])
  )
  put('ppt/slideLayouts/slideLayout1.xml', LAYOUT)
  put(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    rels([{ id: 'rId1', target: '../slideMasters/slideMaster1.xml', type: 'slideMaster' }])
  )
  put('ppt/theme/theme1.xml', THEME)

  return zipSync(files, { level: 6 })
}
