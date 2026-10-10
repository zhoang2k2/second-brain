export type ViewType = 'chats' | 'knowledge' | 'settings';

export interface ShellNavItemViewModel {
  id: string;
  label: string;
  iconName: 'chats' | 'knowledge' | 'settings';
  isActive: boolean;
  hasActiveIndicator: boolean;
  view: ViewType;
}

export interface ShellGroupItemViewModel {
  id: string;
  label: string;
  isActive: boolean;
  hasActiveIndicator: boolean;
  href?: string;
}

export interface ShellGroupViewModel {
  id: string;
  label: string; // Uppercase: 'PERSONAL' or 'PROJECTS'
  isExpanded: boolean;
  items: ShellGroupItemViewModel[];
}

export interface ShellViewModelOptions {
  activeView: ViewType;
  selectedItemId?: string;
  expandedGroups: Record<string, boolean>;
}

export function createPrimaryNavViewModels(activeView: ViewType): ShellNavItemViewModel[] {
  return [
    {
      id: 'chats',
      label: 'Chats',
      iconName: 'chats',
      isActive: activeView === 'chats',
      hasActiveIndicator: activeView === 'chats',
      view: 'chats',
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      iconName: 'knowledge',
      isActive: activeView === 'knowledge',
      hasActiveIndicator: activeView === 'knowledge',
      view: 'knowledge',
    },
  ];
}

export function createGroupViewModels(options: ShellViewModelOptions): ShellGroupViewModel[] {
  const { selectedItemId, expandedGroups } = options;

  return [
    {
      id: 'personal',
      label: 'PERSONAL',
      isExpanded: expandedGroups['personal'] !== false,
      items: [
        {
          id: 'personal-scratchpad',
          label: 'Scratchpad',
          isActive: selectedItemId === 'personal-scratchpad',
          hasActiveIndicator: selectedItemId === 'personal-scratchpad',
        },
        {
          id: 'personal-journal',
          label: 'Journal',
          isActive: selectedItemId === 'personal-journal',
          hasActiveIndicator: selectedItemId === 'personal-journal',
        },
      ],
    },
    {
      id: 'projects',
      label: 'PROJECTS',
      isExpanded: expandedGroups['projects'] !== false,
      items: [
        {
          id: 'project-core',
          label: 'Core Monorepo',
          isActive: selectedItemId === 'project-core',
          hasActiveIndicator: selectedItemId === 'project-core',
        },
        {
          id: 'project-runtime',
          label: 'Fastify Daemon',
          isActive: selectedItemId === 'project-runtime',
          hasActiveIndicator: selectedItemId === 'project-runtime',
        },
      ],
    },
  ];
}
