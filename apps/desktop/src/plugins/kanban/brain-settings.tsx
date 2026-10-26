/** Settings ▸ Plugins ▸ Brain workspace: show or hide the Dashboard and Projects pages. Hiding only removes the
 *  sidebar rows; the data, the agents and the Kanban page itself are untouched. */

import { Switch, useValue } from '@hermes/plugin-sdk'

import { BRAIN } from './brain-copy'
import { $brainModules, type BrainModules } from './brain-data'

const ROWS: { hint: string; id: keyof BrainModules; label: string }[] = [
  { hint: BRAIN.settings.dashboardHint, id: 'dashboard', label: BRAIN.settings.dashboard },
  { hint: BRAIN.settings.projectsHint, id: 'projects', label: BRAIN.settings.projects }
]

export function BrainSettings() {
  const modules = useValue($brainModules)

  return (
    <div className="flex max-w-xl flex-col gap-4 p-4">
      <p className="text-[0.8125rem] text-(--ui-text-tertiary)">{BRAIN.settings.description}</p>
      {ROWS.map(row => (
        <label className="flex items-center gap-3" key={row.id}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[0.875rem] font-medium text-foreground">{row.label}</span>
            <span className="text-[0.75rem] text-(--ui-text-tertiary)">{row.hint}</span>
          </span>
          <Switch
            checked={modules[row.id]}
            onCheckedChange={checked => $brainModules.set({ ...modules, [row.id]: checked })}
          />
        </label>
      ))}
    </div>
  )
}
