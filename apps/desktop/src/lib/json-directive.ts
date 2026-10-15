/**
 * Weaker models write a card or a chart as a directive line — `::card{"type":"video",…}` — instead of the
 * ```card / ```chart fence the prompt teaches. The line is valid JSON in the wrong wrapper, and left alone it
 * prints as text. A line that is exactly `::card{…}` or `::chart{…}` with a JSON object body becomes the fence
 * the renderer already draws; anything that does not parse stays as the model wrote it.
 */
const JSON_DIRECTIVE_LINE = /^([ \t]*)::(card|chart)[ \t]*(\{.*\})[ \t]*$/
const FENCE_LINE = /^[ \t]*(`{3,}|~{3,})/

function asObjectJson(body: string): null | string {
  try {
    const value: unknown = JSON.parse(body)

    return value && typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : null
  } catch {
    return null
  }
}

export function promoteJsonDirectives(text: string): string {
  if (!text.includes('::card') && !text.includes('::chart')) {
    return text
  }

  let fence: null | string = null

  return text
    .split('\n')
    .map(line => {
      const marker = FENCE_LINE.exec(line)?.[1]

      if (marker) {
        fence = fence === null ? marker[0] : marker[0] === fence ? null : fence

        return line
      }

      const match = fence === null ? JSON_DIRECTIVE_LINE.exec(line) : null
      const json = match ? asObjectJson(match[3]) : null

      return match && json ? `${match[1]}\`\`\`${match[2]}\n${match[1]}${json}\n${match[1]}\`\`\`` : line
    })
    .join('\n')
}
