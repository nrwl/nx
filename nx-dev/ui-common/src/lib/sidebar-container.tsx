'use client';
import { Menu } from '@nx/nx-dev-models-menu';
import { Sidebar, SidebarMobile } from './sidebar';
import { useMemo } from 'react';

// TODO(colum): Remove this angular rspack modification once we move angular rspack into main repo (when stable).
const angularRspackSection = {
  id: 'angular-rspack',
  name: 'angular-rspack',
  itemList: [
    {
      id: 'documents',
      path: '/nx-api/angular-rspack/documents',
      name: 'documents',
      children: [
        {
          name: 'createConfig',
          path: '/nx-api/angular-rspack/documents/create-config',
          id: 'create-config',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
        {
          name: 'createServer',
          path: '/nx-api/angular-rspack/documents/create-server',
          id: 'create-server',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
      ],
      isExternal: false,
      disableCollapsible: false,
    },
  ],
  hideSectionHeader: false,
};
const angularRsbuildSection = {
  id: 'angular-rsbuild',
  name: 'angular-rsbuild',
  itemList: [
    {
      id: 'documents',
      path: '/nx-api/angular-rsbuild/documents',
      name: 'documents',
      children: [
        {
          name: 'createConfig',
          path: '/nx-api/angular-rsbuild/documents/create-config',
          id: 'create-config',
          isExternal: false,
          children: [],
          disableCollapsible: false,
        },
        {
          name: 'createServer',
          path: '/nx-api/angular-rsbuild/documents/create-server',
          id: 'create-server',
          isExternal: false,
          children: [],
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
  // TODO(colum): Remove this angular-rspack modification once we move angular rspack into main repo (when stable).
  const menuWithAngularRspack = useMemo(() => {
    const angularIdx = menu.sections.findIndex((s) => s.id === 'angular');
    if (angularIdx === -1) {
      return menu;
    }
    const sections = [
      ...menu.sections.slice(0, angularIdx),
      angularRspackSection,
      angularRsbuildSection,
      ...menu.sections.slice(angularIdx),
    ];
    return {
      ...menu,
      sections,
    };
  }, [menu]);

  return (
    <div id="sidebar" data-testid="sidebar">
      <SidebarMobile
        menu={menuWithAngularRspack}
        toggleNav={toggleNav}
        navIsOpen={navIsOpen}
      />
      <div className="hidden h-full w-72 flex-col border-r border-slate-200 md:flex dark:border-slate-700 dark:bg-slate-900">
        <div className="relative flex flex-grow overflow-y-scroll p-4">
          <Sidebar menu={menuWithAngularRspack} />
        </div>
        {/*<div className="relative flex flex-col space-y-1 border-t border-slate-200 px-4 py-2 dark:border-slate-700">*/}
        {/*  // another section.*/}
        {/*</div>*/}
      </div>
    </div>
  );
}
