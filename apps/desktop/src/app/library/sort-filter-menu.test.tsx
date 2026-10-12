import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NO_FILTERS } from './library-prefs'
import { SortFilterMenu } from './sort-filter-menu'

afterEach(cleanup)

function open(sortable: boolean, filters = NO_FILTERS) {
  render(
    <SortFilterMenu
      filters={filters}
      order="desc"
      prefs={{ order: null, sort: 'updated', view: 'list' }}
      setFilters={() => undefined}
      sortable={sortable}
    />
  )

  const trigger = screen.getByRole('button', { name: 'Sort & filter' })

  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })

  return trigger
}

const text = () => screen.getByRole('menu').textContent ?? ''

describe('the Library sort & filter menu', () => {
  it('lists every sort, then every filter group, in one menu', () => {
    open(true)

    const order = ['Sort', 'Last edited', 'Descending', 'Filter', 'Folder', 'Brain access', 'Created by'].map(label =>
      text().indexOf(label)
    )

    expect(order.every(index => index >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('leaves out the sort where there is no order to choose', () => {
    open(false)

    expect(text()).not.toContain('Last edited')
    expect(text()).toContain('Brain access')
  })

  it('shows how many filters are on', () => {
    const trigger = open(true, { ...NO_FILTERS, access: ['open'], types: ['page', 'image'] })

    expect(trigger.textContent).toBe('3')
  })
})
