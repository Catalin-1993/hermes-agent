import { afterEach, expect, it } from 'vitest'

import { $companionSide, setCompanionSide } from './side-chat'

afterEach(() => {
  window.localStorage.clear()
  setCompanionSide('right')
})

it('docks the companion chat on the right until the owner picks the left', () => {
  expect($companionSide.get()).toBe('right')

  setCompanionSide('left')
  expect($companionSide.get()).toBe('left')
  expect(window.localStorage.getItem('hermes.desktop.companionSide')).toBe('left')

  setCompanionSide('right')
  expect(window.localStorage.getItem('hermes.desktop.companionSide')).toBeNull()
})
