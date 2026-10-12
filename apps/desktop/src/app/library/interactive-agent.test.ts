import { describe, expect, it } from 'vitest'

import { buildingDocument, buildPrompt, changePrompt, isBuilding, looksLikeHtml } from './interactive-agent'

// What the setup card's single button decides, and what Hermes is told.

describe('looksLikeHtml', () => {
  it('takes markup as markup and words as a request', () => {
    expect(looksLikeHtml('<!DOCTYPE html><html></html>')).toBe(true)
    expect(looksLikeHtml('  <div class="a">hi</div>')).toBe(true)
    expect(looksLikeHtml('<my-widget></my-widget>')).toBe(true)
    expect(looksLikeHtml('a loan calculator with a chart')).toBe(false)
    expect(looksLikeHtml('make a < b comparison tool')).toBe(false)
    expect(looksLikeHtml('<3 a heart-rate zone calculator')).toBe(false)
  })
})

describe('a block waiting for Brain', () => {
  it('is recognised by its document, and a real document is not', () => {
    expect(isBuilding(buildingDocument())).toBe(true)
    expect(isBuilding(`\n${buildingDocument()}`)).toBe(true)
    expect(isBuilding('<!doctype html><title>ROI</title>')).toBe(false)
    expect(isBuilding('')).toBe(false)
  })

  it('tells Brain which file to write and which tool call writes it', () => {
    const build = buildPrompt('file_1', ' a loan calculator ')
    const change = changePrompt('file_2', 'ROI', ' add a chart ')

    expect(build).toContain('a loan calculator')
    expect(build).toContain('file_1')
    expect(build).toContain('action "block"')
    expect(change).toContain('“ROI”')
    expect(change).toContain('file_2')
    expect(change).toContain('add a chart')
    expect(change).toContain('action "block"')
  })
})
