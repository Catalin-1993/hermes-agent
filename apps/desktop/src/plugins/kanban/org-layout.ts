/**
 * Where each card stands on the Agents chart, and the lines between them. Pure, so it is tested.
 *
 * The automatic layout is a tidy tree under the owner (the CEO): a manager sits centred over its reports; three or
 * more reports who lead nobody stack in a column under it (two columns from four), hung off a rail, so a big team
 * grows down rather than wide. Any card the owner dragged keeps the place it was put; the lines follow the cards
 * wherever they stand.
 */

import { type OrgNode, stacks } from './org-model'

export interface Point {
  x: number
  y: number
}

export interface Size {
  height: number
  width: number
}

/** The owner's card in the layout. */
export const CEO = '__ceo__'

/** Spacing (px, at 100%). */
export const GAP = { level: 56, rail: 28, row: 12, sibling: 28, stackColumn: 20 } as const

interface Box {
  height: number
  place: (x: number, y: number, out: Map<string, Point>) => void
  width: number
}

const columnsOf = (node: OrgNode) => (node.reports.length >= 4 ? 2 : 1)

type SizeOf = (name: string) => Size

function stackBox(node: OrgNode, sizeOf: SizeOf): Box {
  const top = sizeOf(node.profile.name)
  const width0 = sizeOf(node.reports[0]!.profile.name).width
  const cols = columnsOf(node)

  const rows = Array.from({ length: Math.ceil(node.reports.length / cols) }, (_, row) =>
    Math.max(...node.reports.slice(row * cols, row * cols + cols).map(report => sizeOf(report.profile.name).height))
  )

  const block = GAP.rail + cols * width0 + (cols - 1) * GAP.stackColumn
  const width = Math.max(top.width, block)

  return {
    height: top.height + GAP.level + rows.reduce((sum, h) => sum + h, 0) + (rows.length - 1) * GAP.row,
    place: (x, y, out) => {
      out.set(node.profile.name, { x: x + (width - top.width) / 2, y })
      const left = x + (width - block) / 2 + GAP.rail
      let rowTop = y + top.height + GAP.level

      rows.forEach((rowHeight, row) => {
        node.reports.slice(row * cols, row * cols + cols).forEach((report, col) => {
          out.set(report.profile.name, { x: left + col * (width0 + GAP.stackColumn), y: rowTop })
        })
        rowTop += rowHeight + GAP.row
      })
    },
    width
  }
}

/** A row of boxes side by side under a card of `top` size: the shape of a manager over its reports. */
function rowBox(name: string, top: Size, children: Box[]): Box {
  if (!children.length) {
    return { height: top.height, place: (x, y, out) => out.set(name, { x, y }), width: top.width }
  }

  const span = children.reduce((sum, child) => sum + child.width, 0) + GAP.sibling * (children.length - 1)
  const width = Math.max(top.width, span)

  return {
    height: top.height + GAP.level + Math.max(...children.map(child => child.height)),
    place: (x, y, out) => {
      out.set(name, { x: x + (width - top.width) / 2, y })
      let left = x + (width - span) / 2

      for (const child of children) {
        child.place(left, y + top.height + GAP.level, out)
        left += child.width + GAP.sibling
      }
    },
    width
  }
}

function boxOf(node: OrgNode, sizeOf: SizeOf): Box {
  return stacks(node)
    ? stackBox(node, sizeOf)
    : rowBox(
        node.profile.name,
        sizeOf(node.profile.name),
        node.reports.map(report => boxOf(report, sizeOf))
      )
}

/** The automatic place of every card (top-left corners), the CEO's under `CEO`, starting at 0,0. Each card's
 *  measured size decides the room it takes, so short cards do not leave tall gaps. */
export function autoLayout(trees: readonly OrgNode[], sizeOf: SizeOf): Map<string, Point> {
  const out = new Map<string, Point>()
  rowBox(
    CEO,
    sizeOf(CEO),
    trees.map(tree => boxOf(tree, sizeOf))
  ).place(0, 0, out)

  return out
}

/** The automatic places with the owner's own placements on top: a card put somewhere by hand stays there, and
 *  the people under it come along, keeping their places relative to it (unless they were put somewhere themselves).
 *  Names no longer on the chart are ignored. */
export function withPlaced(
  auto: Map<string, Point>,
  placed: Record<string, Point> | undefined,
  trees: readonly OrgNode[]
): Map<string, Point> {
  const out = new Map(auto)

  const walk = (node: OrgNode, dx: number, dy: number) => {
    const name = node.profile.name
    const own = placed?.[name]
    const base = auto.get(name)

    if (!base) {
      return
    }

    const shift = own ? { dx: own.x - base.x, dy: own.y - base.y } : { dx, dy }
    out.set(name, { x: base.x + shift.dx, y: base.y + shift.dy })
    node.reports.forEach(report => walk(report, shift.dx, shift.dy))
  }

  trees.forEach(tree => walk(tree, 0, 0))

  return out
}

/** The area every card covers, so the chart can be shifted to start at 0,0 and sized. */
export function bounds(places: Map<string, Point>, sizeOf: (name: string) => Size) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [name, point] of places) {
    const size = sizeOf(name)
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x + size.width)
    maxY = Math.max(maxY, point.y + size.height)
  }

  return places.size
    ? { height: maxY - minY, minX, minY, width: maxX - minX }
    : { height: 0, minX: 0, minY: 0, width: 0 }
}

/** The lines: from each manager's bottom to each report — an elbow to the top of a report in a row, a rail to the
 *  left side of a report in a stack. SVG path data, one per report. */
export function links(
  trees: readonly OrgNode[],
  places: Map<string, Point>,
  sizeOf: (name: string) => Size
): { d: string; id: string }[] {
  const out: { d: string; id: string }[] = []

  const link = (parent: string, child: string, rail: boolean) => {
    const from = places.get(parent)
    const to = places.get(child)

    if (!from || !to) {
      return
    }

    const top = sizeOf(parent)
    const startX = from.x + top.width / 2
    const startY = from.y + top.height

    if (rail) {
      const railX = to.x - GAP.rail / 2
      const midY = startY + GAP.level / 2
      const endY = to.y + sizeOf(child).height / 2
      out.push({ d: `M${startX} ${startY}V${midY}H${railX}V${endY}H${to.x}`, id: `${parent}>${child}` })

      return
    }

    const endX = to.x + sizeOf(child).width / 2
    const midY = startY + Math.max(12, (to.y - startY) / 2)
    out.push({ d: `M${startX} ${startY}V${midY}H${endX}V${to.y}`, id: `${parent}>${child}` })
  }

  const walk = (node: OrgNode) => {
    const rail = stacks(node)
    node.reports.forEach(report => {
      link(node.profile.name, report.profile.name, rail)
      walk(report)
    })
  }

  trees.forEach(tree => {
    link(CEO, tree.profile.name, false)
    walk(tree)
  })

  return out
}

/** The card under a point, if any (the one being dragged left out). */
export function cardAt(
  point: Point,
  places: Map<string, Point>,
  sizeOf: (name: string) => Size,
  skip: string
): null | string {
  for (const [name, place] of places) {
    const size = sizeOf(name)

    if (
      name !== skip &&
      point.x >= place.x &&
      point.x <= place.x + size.width &&
      point.y >= place.y &&
      point.y <= place.y + size.height
    ) {
      return name
    }
  }

  return null
}
