'use client';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { Sidebar, SidebarMobile } from './sidebar';
import { useMemo } from 'react';

// TODO(jack): Remove this rspack modification once we move rspack into main repo (when stable).
const rspackSection = {
  id: 'rspack',
  name: 'rspack',
  itemList: [
    {
      id: 'documents',
      path: '/nx-api/rspack/documents',
      name: 'documents',
      children: [
        {
          name: 'Overview of the Nx Rspack plugin',
          path: '/nx-api/rspack/documents/overview',
          id: 'overview',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
        {
          name: 'Rspack plugins',
          path: '/nx-api/rspack/documents/rspack-plugins',
          id: 'rspack-plugins',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
        {
          name: 'How to configure Rspack in your Nx workspace',
          path: '/nx-api/rspack/documents/rspack-config-setup',
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
      path: '/nx-api/rspack/executors',
      name: 'executors',
      children: [
        {
          id: 'rspack',
          path: '/nx-api/rspack/executors/rspack',
          name: 'rspack',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
        {
          id: 'dev-server',
          path: '/nx-api/rspack/executors/dev-server',
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
      path: '/nx-api/rspack/generators',
      name: 'generators',
      children: [
        {
          id: 'init',
          path: '/nx-api/rspack/generators/init',
          name: 'init',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
        {
          id: 'configuration',
          path: '/nx-api/rspack/generators/configuration',
          name: 'configuration',
          children: [],
          isExternal: false,
          disableCollapsible: false,
        },
        {
          id: 'application',
          path: '/nx-api/rspack/generators/application',
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
  toggleNav,
}: {
  menu: Menu;
  navIsOpen: boolean;
  toggleNav: (value: boolean) => void;
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
      <SidebarMobile
        menu={menuWithRspack}
        toggleNav={toggleNav}
        navIsOpen={navIsOpen}
      />
      <div className="hidden h-full w-72 flex-col border-r border-slate-200 md:flex dark:border-slate-700 dark:bg-slate-900">
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
