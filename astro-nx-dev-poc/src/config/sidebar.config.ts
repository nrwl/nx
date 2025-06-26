export const sidebarGroups: SidebarGroup[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: '🚀',
    urlPattern: /^\/getting-started\//,
    priority: 1,
    items: [
      {
        label: 'Getting Started',
        autogenerate: { directory: 'getting-started' },
      },
    ],
  },
  {
    id: 'guides',
    label: 'Guides',
    icon: '📚',
    urlPattern: /^\/guides\//,
    priority: 2,
    items: [
      {
        label: 'Guides',
        autogenerate: { directory: 'guides' },
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    icon: '📖',
    urlPattern: /^\/(?:api|reference)\//,
    priority: 3,
    items: [
      {
        label: 'API Reference',
        items: [
          { label: 'Nx CLI', slug: 'api/nx-cli' },
          { label: 'Nx Cloud CLI', slug: 'api/nx-cloud-cli' },
          {
            label: 'Plugins',
            items: [{ label: 'Overview', slug: 'api/plugins' }],
          },
        ],
      },
      {
        label: 'Reference',
        autogenerate: { directory: 'reference' },
      },
    ],
  },
];

export function getActiveGroup(pathname: string): string {
  const matchedGroup = sidebarGroups
    .filter((group) => group.urlPattern.test(pathname))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

  return matchedGroup?.id || sidebarGroups[0].id;
}

export function getAllSidebarItems(): SidebarItem[] {
  return sidebarGroups.flatMap((group) => group.items);
}
