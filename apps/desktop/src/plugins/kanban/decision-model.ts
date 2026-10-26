/** A decision, read the way the agent was asked to write it: Ask / Why / If approved / If declined / Report.
 *  Text without those labels is just the report. Pure, so it is tested. */

export interface Decision {
  ask: string
  approve: string
  decline: string
  /** The findings: what is left once the labelled parts are taken out. */
  report: string
  why: string
}

const LABELS: Record<string, Exclude<keyof Decision, never>> = {
  ask: 'ask',
  'if approved': 'approve',
  'if declined': 'decline',
  report: 'report',
  why: 'why'
}

/** `**Ask:** text`, `Ask: text` or `ask — text`: the label, then what follows it on the line. */
const LABEL_LINE = /^\s*[*_#\s]*(ask|why|if approved|if declined|report)\s*[*_]*\s*[:—-]\s*[*_]*\s*(.*)$/i

export function parseDecision(text?: null | string): Decision {
  const out: Decision = { approve: '', ask: '', decline: '', report: '', why: '' }
  const loose: string[] = []
  let current: keyof Decision | null = null

  for (const line of (text ?? '').split('\n')) {
    const match = LABEL_LINE.exec(line)

    if (match) {
      current = LABELS[match[1]!.toLowerCase()]!
      out[current] = match[2]!.trim()
    } else if (current) {
      out[current] = `${out[current]}\n${line}`.trim()
    } else {
      loose.push(line)
    }
  }

  const rest = loose.join('\n').trim()

  // Unlabelled text before any label, or in a message with no labels at all, is the report.
  out.report = [rest, out.report].filter(Boolean).join('\n\n')

  return out
}

/** Whether the agent wrote any of the labelled parts (so the card can say what it did and did not explain). */
export const hasStructure = (decision: Decision) =>
  Boolean(decision.ask || decision.why || decision.approve || decision.decline)
