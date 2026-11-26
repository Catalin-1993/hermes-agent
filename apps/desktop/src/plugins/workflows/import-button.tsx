import { host, useQueryClient } from '@hermes/plugin-sdk'
import { type ReactNode, useRef } from 'react'

import { importWorkflow, keys, type WorkflowDetail } from './api'
import { COPY } from './copy'

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** A file picker for an exported workflow; `children` is what the owner clicks. */
export function ImportButton({
  children,
  className,
  onImported
}: {
  children: ReactNode
  className: string
  onImported: (detail: WorkflowDetail) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const read = async (file: File) => {
    let data: unknown

    try {
      data = JSON.parse(await file.text())
    } catch {
      host.notify({ kind: 'error', message: COPY.files.importFailed })

      return
    }

    try {
      const detail = await importWorkflow(data)
      await queryClient.invalidateQueries({ queryKey: keys.list })
      host.notify({ kind: 'success', message: COPY.files.imported(detail.name) })
      onImported(detail)
    } catch (e) {
      host.notify({ kind: 'error', message: errorText(e) })
    }
  }

  return (
    <>
      <button
        aria-label={COPY.files.importHint}
        className={className}
        onClick={() => input.current?.click()}
        title={COPY.files.importHint}
        type="button"
      >
        {children}
      </button>
      <input
        accept=".json,application/json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''

          if (file) {
            void read(file)
          }
        }}
        ref={input}
        type="file"
      />
    </>
  )
}
