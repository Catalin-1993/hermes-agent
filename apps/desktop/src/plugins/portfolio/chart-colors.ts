/** Canvas charts cannot read CSS variables; this resolves a token to the colour it is right now. */

let probe: CanvasRenderingContext2D | null = null

/** `var(--ui-green)` (or any CSS colour, `color-mix` included) as an `rgba(...)` string. */
export function resolveColor(token: string, alpha = 1): string {
  const element = document.createElement('span')
  element.style.color = token
  document.body.appendChild(element)
  const computed = getComputedStyle(element).color
  element.remove()

  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })

  if (!probe) {
    return computed
  }

  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = computed
  probe.fillRect(0, 0, 1, 1)
  const [red, green, blue, opacity] = probe.getImageData(0, 0, 1, 1).data

  return `rgba(${red}, ${green}, ${blue}, ${((opacity / 255) * alpha).toFixed(3)})`
}
