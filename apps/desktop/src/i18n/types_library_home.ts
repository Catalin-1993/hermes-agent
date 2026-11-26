/** All as the agent's long-term memory: the Library's Memory view (`app/library/home/`). */
export interface LibraryHomeTranslations {
  memory: string
  graphHint: string
  graphLabel: string
  modes: Record<'entities' | 'experience' | 'observation' | 'world', string>
  linkKinds: Record<'causal' | 'cooccurrence' | 'entity' | 'semantic' | 'temporal', string>
  few: string
  many: string
  fit: string
  graphCount: (nodes: number, links: number) => string
  mentions: (count: number) => string
  links: (count: number) => string
  emptyModeTitle: (mode: string) => string
  emptyModeBody: string
  atGlance: string
  counts: Record<'documents' | 'entities' | 'links' | 'memories', string>
  lastWrite: (when: string) => string
  activity: string
  activityLabel: (total: number) => string
  activityCaption: (total: number) => string
  topEntities: string
  recentDocuments: string
  conversation: string
  memoriesCount: (count: number) => string
  noDocuments: string
  knowledge: string
  noKnowledge: string
  untitled: string
  sideIdle: string
  retry: string
  wakingTitle: string
  wakingBody: string
  asleepTitle: string
  asleepBody: string
  providerTitle: string
  providerBody: string
  errorTitle: string
  errorBody: string
  detail: {
    kinds: Record<'document' | 'entity' | 'memory', string>
    close: string
    failed: string
    type: string
    remembered: string
    context: string
    entities: string
    mentions: string
    firstSeen: string
    lastSeen: string
    observations: string
    saved: string
    extracted: string
    transcript: string
  }
}
