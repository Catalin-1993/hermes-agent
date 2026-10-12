import { describe, expect, it } from 'vitest'

import { fileCategoryOf } from './file-types'

describe('a file’s type, from its name', () => {
  it('tells a PDF, a Word file and a spreadsheet apart by extension, whatever the case', () => {
    expect(fileCategoryOf({ file_name: 'Proposal.PDF', mime: '' })).toBe('pdf')
    expect(fileCategoryOf({ file_name: 'brief.docx', mime: '' })).toBe('document')
    expect(fileCategoryOf({ file_name: 'budget.xlsx', mime: '' })).toBe('spreadsheet')
  })

  it('falls back to the MIME type when the name has no known extension', () => {
    expect(fileCategoryOf({ file_name: 'scan', mime: 'application/pdf' })).toBe('pdf')
  })
})
