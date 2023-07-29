import { Menu } from '@nx/nx-dev/models-menu';
import { Sidebar, SidebarMobile } from './sidebar';
import { useMemo } from 'react';

// TODO(jack): Remove this rspack modification once we move rspack into main repo (when stable).
const rspackSection = {
  id: 'rspack',
  name: 'rspack',
  itemList: [
    {
      id: 'documents',
      path: '/packages/rspack/documents',
      name: 'documents',
      children: [
        {
          name: 'Overview of the Nx Rspack plugin',
          path: '/packages/rspack/documents/overview',
          id: 'overview',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
        {
          name: 'Rspack plugins',
          path: '/packages/rspack/documents/rspack-plugins',
          id: 'rspack-plugins',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
        {
          name: 'How to configure Rspack in your Nx workspace',
          path: '/packages/rspack/documents/rspack-config-setup',
          id: 'rspack-config-setup',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
      ],
      isExternal: false,
      disableCollapsible: false,
    },
    {
      id: 'executors',
      path: '/packages/rspack/executors',
      name: 'executors',
      children: [
        {
          id: 'rspack',
          path: '/packages/rspack/executors/rspack',
          name: 'rspack',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
        {
          id: 'dev-server',
          path: '/packages/rspack/executors/dev-server',
          name: 'dev-server',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
      ],
      isExternal: false,
      disableCollapsible: false,
    },
    {
      id: 'generators',
      path: '/packages/rspack/generators',
      name: 'generators',
      children: [
        {
          id: 'init',
          path: '/packages/rspack/generators/init',
          name: 'init',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
        {
          id: 'configuration',
          path: '/packages/rspack/generators/configuration',
          name: 'configuration',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
        {
          id: 'application',
          path: '/packages/rspack/generators/application',
          name: 'application',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
      ],
      isExternal: false,
      disableCollapsible: false,
    },
  ],
  hideSectionHeader: false,
};

export function SidebarContainer({
  menu,
  navIsOpen,
}: {
  menu: Menu;
  navIsOpen: boolean;
}): JSX.Element {
  // TODO(jack): Remove this rspack modification once we move rspack into main repo (when stable).
  const menuWithRspack = useMemo(() => {
    const storybookIdx = menu.sections.findIndex((s) => s.id === 'storybook');
    const sections =
      storybookIdx > -1
        ? [
            ...menu.sections.slice(0, storybookIdx),
            rspackSection,
            ...menu.sections.slice(storybookIdx),
          ]
        : menu.sections;
    return {
      ...menu,
      sections,
    };
  }, [menu]);

  return (
    <div id="sidebar" data-testid="sidebar">
      <SidebarMobile menu={menuWithRspack} navIsOpen={navIsOpen} />
      <div className="hidden h-full w-72 flex-col border-r border-slate-200 dark:border-slate-700 dark:bg-slate-900 md:flex">
        <div className="relative flex flex-grow overflow-y-scroll p-4">
          <Sidebar menu={menuWithRspack} />
        </div>
        {/*<div className="relative flex flex-col space-y-1 border-t border-slate-200 px-4 py-2 dark:border-slate-700">*/}
        {/*  // another section.*/}
        {/*</div>*/}
      </div>
    </div>
  );
}
