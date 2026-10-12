/** An element as a PNG, drawn without a screenshot permission: its DOM goes into an SVG `foreignObject`
 *  and that SVG is painted onto a canvas. It only holds for self-contained markup — inline styles, pictures
 *  as data URLs — which is exactly what a slide is (it is built that way so its PDF export works too). */

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** Pictures the SVG cannot fetch for itself (blob: and relative URLs) become data URLs. */
async function inlinePictures(root: HTMLElement) {
  await Promise.all(
    [...root.querySelectorAll('img')].map(async img => {
      if (!img.src || img.src.startsWith('data:')) {
        return
      }

      try {
        img.src = await blobToDataUrl(await (await fetch(img.src)).blob())
      } catch {
        img.removeAttribute('src')
      }
    })
  )
}

/** What a page's look is made of. The picture is drawn away from the app's stylesheet, so each element
 *  carries the computed values of these (a short list: the whole set would be thousands of declarations a node). */
const LOOK = [
  'align-items',
  'align-self',
  'background-color',
  'background-image',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-spacing',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-style',
  'border-top-width',
  'bottom',
  'box-shadow',
  'box-sizing',
  'color',
  'column-gap',
  'display',
  'fill',
  'flex-basis',
  'flex-direction',
  'flex-grow',
  'flex-shrink',
  'flex-wrap',
  'font-family',
  'font-size',
  'font-style',
  'font-variant-numeric',
  'font-weight',
  'grid-template-columns',
  'grid-template-rows',
  'height',
  'justify-content',
  'justify-items',
  'left',
  'letter-spacing',
  'line-height',
  'list-style-type',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'opacity',
  'overflow-x',
  'overflow-y',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'position',
  'right',
  'row-gap',
  'stroke',
  'stroke-width',
  'table-layout',
  'text-align',
  'text-decoration-line',
  'text-indent',
  'text-overflow',
  'text-transform',
  'top',
  'transform',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
  'z-index'
]

/** Give every clone node the computed look of its source, so the picture needs no stylesheet. Both trees
 *  have the same shape (the clone was just made), so they are walked together. */
function inlineLook(source: Element, clone: Element) {
  const computed = getComputedStyle(source)

  if (computed.display === 'none') {
    clone.remove()

    return
  }

  const target = clone as HTMLElement

  if (target.style) {
    target.setAttribute('style', LOOK.map(name => `${name}:${computed.getPropertyValue(name)}`).join(';'))
    target.removeAttribute('class')
  }

  const from = [...source.children]
  const into = [...clone.children]

  from.forEach((child, index) => into[index] && inlineLook(child, into[index]))
}

/** The first background that is not see-through, from the element outwards. */
function backdrop(el: Element | null): string {
  for (let node = el; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor

    if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
      return color
    }
  }

  return '#ffffff'
}

interface RasterizeOptions {
  height?: number
  /** Keep a long element's top this tall (CSS px). */
  maxHeight?: number
  /** Copy the app's computed look onto the element (anything not built with inline styles needs this). */
  styled?: boolean
  width?: number
  /** A selector for what only belongs to editing (tools, add buttons): left out of the picture. */
  without?: string
}

/** The widest a picture needs to be to read; a wider element is scaled down to it. */
const MAX_PICTURE_WIDTH = 1400

export async function rasterizeElement(source: HTMLElement, options: RasterizeOptions = {}): Promise<string> {
  const { maxHeight = 2400, styled = false, without = '' } = options
  const box = source.getBoundingClientRect()
  const width = Math.max(1, Math.round(options.width ?? (styled ? box.width : 1280)))
  const height = Math.max(1, Math.round(options.height ?? (styled ? Math.min(source.scrollHeight, maxHeight) : 720)))
  const clone = source.cloneNode(true) as HTMLElement

  // The looks are copied while both trees still match; only then is the editing chrome cut away.
  if (styled) {
    inlineLook(source, clone)
  }

  if (without) {
    clone.querySelectorAll(without).forEach(el => el.remove())
  }

  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.overflow = 'hidden'
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  await inlinePictures(clone)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`

  const image = new Image()

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('could not draw the element'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })

  const scale = Math.min(1, MAX_PICTURE_WIDTH / width)
  const canvas = document.createElement('canvas')

  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('no canvas')
  }

  if (styled) {
    context.fillStyle = backdrop(source)
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}
