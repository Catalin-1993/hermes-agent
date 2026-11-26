/**
 * The inspector's inputs: a text field that records one undo step per focus (typing a prompt is one
 * undo, not one per letter) and a select over a fixed list of choices.
 */

import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hermes/plugin-sdk'
import { useRef } from 'react'

import { FIELD, MONO, TEXTAREA } from './ui'

/** A text input that edits on every keystroke but records one undo step per focus. */
function useRecorded() {
  const recorded = useRef(false)

  return {
    onBlur: () => {
      recorded.current = false
    },
    record: () => {
      const first = !recorded.current
      recorded.current = true

      return first
    }
  }
}

export function TextInput({
  mono,
  multiline,
  onChange,
  placeholder,
  rows,
  value
}: {
  mono?: boolean
  multiline?: boolean
  onChange: (value: string, record: boolean) => void
  placeholder?: string
  rows?: number
  value: string
}) {
  const { onBlur, record } = useRecorded()

  const common = {
    onBlur,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value, record()),
    placeholder,
    spellCheck: !mono,
    value
  }

  return multiline ? (
    <textarea className={cn(TEXTAREA, mono && MONO)} rows={rows ?? 4} {...common} />
  ) : (
    <input className={cn(FIELD, mono && MONO)} {...common} />
  )
}

export function Choice<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string
  onChange: (value: T) => void
  options: { disabled?: boolean; label: string; value: T }[]
  value: T
}) {
  return (
    <Select onValueChange={next => onChange(next as T)} value={value}>
      <SelectTrigger aria-label={label} className="h-[2.125rem] rounded-[10px] text-[0.84375rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
