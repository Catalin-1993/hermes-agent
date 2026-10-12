import { strToU8, zipSync } from 'fflate'

import type { Deck } from './deck'
import { type Align, type Block, orderedNumber, parseBlocks } from './deck-blocks'
import { parseInline, type Span } from './deck-inline'
import type { ImageLoader, PptxImage } from './deck-pptx'

/** A deck as a Word document (.docx): each slide a section of real paragraphs — headings, lists, quotes,
 *  code, pictures — to read or reshape in Word, Pages or Google Docs. Like the PowerPoint export it is
 *  written by hand into a ZIP of XML parts with the `fflate` the app already carries. */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const EMU_PER_INCH = 914400
/** Text width of a Letter/A4 page with one-inch margins, in EMU: the widest a picture gets. */
const MAX_PICTURE_W = Math.round(6.25 * EMU_PER_INCH)
const MAX_PICTURE_H = Math.round(5 * EMU_PER_INCH)

const escapeXml = (text: string) =>
  text.replace(/[&<>"]/g, char => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)

const run = (text: string, props = '') =>
  `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`

/** Each span's marks, font, size and colour as Word run properties. */
function runProps(part: Omit<Span, 'text'>, base: string): string {
  const props = [
    base,
    part.bold ? '<w:b/>' : '',
    part.italic ? '<w:i/>' : '',
    part.strike ? '<w:strike/>' : '',
    part.underline || part.link ? '<w:u w:val="single"/>' : '',
    part.code
      ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>'
      : part.font
        ? `<w:rFonts w:ascii="${escapeXml(part.font)}" w:hAnsi="${escapeXml(part.font)}"/>`
        : '',
    part.link && !part.color ? '<w:color w:val="3B5BDB"/>' : '',
    part.color ? `<w:color w:val="${part.color.replace('#', '').toUpperCase()}"/>` : '',
    part.size ? `<w:sz w:val="${Math.round(part.size * 2)}"/><w:szCs w:val="${Math.round(part.size * 2)}"/>` : ''
  ]

  return props.join('')
}

/** A block's words as Word runs. */
function runs(text: string, base = ''): string {
  return parseInline(text)
    .map(part => run(part.text, runProps(part, base)))
    .join('')
}

const jc = (align?: Align) =>
  align && align !== 'left' ? `<w:jc w:val="${align === 'right' ? 'right' : 'center'}"/>` : ''

const paragraph = (inner: string, props = '') => `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${inner}</w:p>`

interface Picture {
  image: PptxImage
  id: number
}

function pictureXml({ id, image }: Picture, alt: string): string {
  const scale = Math.min(1, MAX_PICTURE_W / (image.w * 9525), MAX_PICTURE_H / (image.h * 9525))
  const cx = Math.round(image.w * 9525 * scale)
  const cy = Math.round(image.h * 9525 * scale)

  return paragraph(
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}" descr="${escapeXml(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.${image.ext === 'jpeg' ? 'jpg' : 'png'}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg${id}" xmlns:r="${R}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
    '<w:spacing w:before="120" w:after="120"/>'
  )
}

const STYLES = `${XML}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="288" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="56"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="10" w:color="3B5BDB"/></w:pBdr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style></w:styles>`

/** One block of a slide as Word paragraphs; a picture that could not be loaded stays as its caption. */
function blockXml(block: Block, pictures: Map<string, Picture>): string {
  if (block.kind === 'heading') {
    return paragraph(runs(block.text), `<w:pStyle w:val="Heading${block.level}"/>${jc(block.align)}`)
  }

  if (block.kind === 'paragraph') {
    return paragraph(runs(block.text), jc(block.align))
  }

  if (block.kind === 'quote') {
    return paragraph(runs(block.text), `<w:pStyle w:val="Quote"/>${jc(block.align)}`)
  }

  if (block.kind === 'code') {
    return block.text
      .split('\n')
      .map(line =>
        paragraph(
          run(line, '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/>'),
          '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/><w:spacing w:after="0" w:line="260" w:lineRule="auto"/>'
        )
      )
      .join('')
  }

  if (block.kind === 'image') {
    const picture = pictures.get(block.src)

    if (picture) {
      return pictureXml(picture, block.alt)
    }

    return block.alt ? paragraph(runs(`[${block.alt}]`)) : ''
  }

  return block.items
    .map((item, index) => {
      const mark = item.ordered ? `${orderedNumber(block.items, index)}.` : item.depth ? '–' : '•'
      const left = 360 + item.depth * 360

      return paragraph(
        `${run(`${mark}\t`)}${runs(item.text)}`,
        `<w:tabs><w:tab w:val="left" w:pos="${left}"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="${left}" w:hanging="360"/>`
      )
    })
    .join('')
}

/** The deck as a .docx: the title, then each slide in order, a page break between slides. */
export async function buildDocx(deck: Deck, title: string, load: ImageLoader): Promise<Uint8Array> {
  const sources = new Set<string>()

  for (const slide of deck.slides) {
    for (const block of parseBlocks(slide)) {
      if (block.kind === 'image') {
        sources.add(block.src)
      }
    }
  }

  const pictures = new Map<string, Picture>()
  let counter = 0

  for (const src of sources) {
    const image = await load(src).catch(() => null)

    if (image) {
      counter += 1
      pictures.set(src, { id: counter, image })
    }
  }

  const body = [
    paragraph(run(title), '<w:pStyle w:val="Title"/>'),
    ...deck.slides.map((slide, index) => {
      const blocks = parseBlocks(slide)
      const content = blocks.map(block => blockXml(block, pictures)).join('')

      return `${index > 0 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : ''}${content}`
    })
  ].join('')

  const media = [...pictures.values()]

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`
    ),
    '_rels/.rels': strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`
    ),
    'docProps/core.xml': strToU8(
      `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Brain</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
    ),
    'word/document.xml': strToU8(
      `${XML}<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`
    ),
    'word/_rels/document.xml.rels': strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="${R}/styles" Target="styles.xml"/>${media.map(({ id, image }) => `<Relationship Id="rImg${id}" Type="${R}/image" Target="media/image${id}.${image.ext === 'jpeg' ? 'jpg' : 'png'}"/>`).join('')}</Relationships>`
    ),
    'word/styles.xml': strToU8(STYLES)
  }

  for (const { id, image } of media) {
    files[`word/media/image${id}.${image.ext === 'jpeg' ? 'jpg' : 'png'}`] = image.bytes
  }

  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, data]) => [name, [data, { level: name.startsWith('word/media/') ? 0 : 6 }]])
    )
  )
}
