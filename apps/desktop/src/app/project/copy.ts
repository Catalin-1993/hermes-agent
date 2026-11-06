/** The project bar and hub's words (English, like the Projects views). */
export const PROJECT = {
  noFolder: 'This project has no folder, so it cannot keep instructions or knowledge.',
  hub: 'Project hub',
  hubHint: 'Instructions, connectors and knowledge for this project.',
  closeHub: 'Close project hub',
  home: {
    createdBy: (name: string) => `Created by ${name}`,
    updated: (date: string) => `Updated ${date}`,
    recent: 'Recent',
    noRecent: 'No conversations yet. Start one below.'
  },
  cards: {
    add: 'Add',
    edit: 'Edit',
    fold: (title: string, open: boolean) => `${open ? 'Close' : 'Open'} the ${title} list`,
    instructionsHint: 'Guide how Brain responds across all tasks in this project.',
    filesTitle: 'Files & sources',
    filesHint: 'Attach files and webpages for Brain to use across all tasks.',
    filesCount: (files: number, notes: number) =>
      [
        files ? `${files} ${files === 1 ? 'file' : 'files'}` : '',
        notes ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : ''
      ]
        .filter(Boolean)
        .join(', '),
    upload: 'Upload',
    uploadFiles: 'Files',
    uploadNote: 'Note',
    searchWeb: 'Search web',
    searchWebDraft: 'Search the web for  and save the useful pages to this project.',
    skillsTitle: 'Skills',
    skillsHint: 'Use repeated workflows across tasks when relevant.',
    browseSkills: 'Browse skills',
    createSkill: 'Create with Brain',
    createSkillDraft: 'Create a skill for this project that ',
    triggerTitle: 'Trigger task',
    triggerHint: 'Run a task in this project by itself, on a schedule.',
    triggerDialog: 'New trigger task',
    triggerPrompt: 'What should Brain do?',
    triggerPlaceholder: 'e.g. Every morning, sum up what changed in this project.',
    triggerWhen: 'When',
    triggerHourly: 'Every hour',
    triggerDaily: 'Daily at 9:00',
    triggerWeekly: 'Mondays at 9:00',
    triggerCreate: 'Create',
    triggerFailed: 'Could not create the task',
    websiteTitle: 'Website',
    websiteHint: 'Build a website for this project and keep working on it here.',
    websiteDraft: 'Build a website for this project: ',
    teamTitle: 'Team',
    teamHint: 'The agents you can work with here.'
  },
  panel: {
    instructions: 'Instructions',
    instructionsHint: 'How the agent works in this project. Every chat started in its folder reads this first.',
    instructionsPlaceholder: 'e.g. Answer in Romanian. Prices are in EUR. Never change files in /legal.',
    savedAs: (file: string) => `Saved as ${file} in the project folder.`,
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Could not save',
    connectors: 'Connectors',
    connectorsHint: 'The services your agent is connected to. They are set up once and shared by every project.',
    noConnectors: 'No connectors yet.',
    manageConnectors: 'Manage connectors',
    on: 'On',
    off: 'Off',
    knowledge: 'Knowledge',
    knowledgeHint:
      'Files and notes only for this project. They are kept in its folder and the agent reads them when a task needs them.',
    noKnowledge: 'No files or notes yet.',
    addNote: 'Add note',
    addFile: 'Add files',
    noteTitle: 'Title',
    noteBody: 'What the agent should know…',
    saveNote: 'Add',
    cancel: 'Cancel',
    remove: (title: string) => `Remove “${title}”`,
    adding: (at: number, total: number) => `Adding ${at} of ${total}…`,
    fileFailed: (name: string, error: string) => `Could not add ${name}: ${error}`
  }
}
