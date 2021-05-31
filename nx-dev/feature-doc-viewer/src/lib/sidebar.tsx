import React, { useCallback, useState } from 'react';
import cx from 'classnames';
import Link from 'next/link';
import {
  Menu,
  MenuItem,
  MenuSection,
  VersionMetadata,
} from '@nrwl/nx-dev/data-access-documents';
import { useRouter } from 'next/router';
import { Selector } from '@nrwl/nx-dev/ui/common';

export interface SidebarProps {
  menu: Menu;
  version: VersionMetadata;
  versionList: VersionMetadata[];
  flavorList: any[];
  flavor: any;
}

export function Sidebar({
  flavor,
  flavorList,
  version,
  versionList,
  menu,
}: SidebarProps) {
  const router = useRouter();
  const getStartedPath = (version: string, flavor: string): string =>
    `/${version}/${flavor}/getting-started/${
      version === 'latest' ? 'getting-started' : 'intro'
    }`;

  return (
    <div
      data-testid="sidebar"
      className="fixed z-40 inset-0 flex-none h-full bg-black bg-opacity-25 w-full lg:bg-white lg:static lg:h-auto lg:overflow-y-visible lg:pt-o lg:w-64 lg:block hidden border-r border-gray-200"
    >
      <div
        data-testid="navigation-wrapper"
        className="h-full overflow-y-auto scrolling-touch lg:h-auto lg:block lg:relative lg:sticky lg:bg-transparent overflow-hidden lg:top-18 bg-white mr-24 lg:mr-0 pr-2 sm:pr-4 xl:pr-6"
      >
        <div className="hidden lg:block h-12 pointer-events-none absolute inset-x-0 z-10 bg-gradient-to-b from-white" />
        <div className="px-1 pt-6 sm:px-3 xl:px-5 lg:pt-10">
          <Selector
            data={versionList.map((version) => ({
              label: version.name,
              value: version.id,
            }))}
            selected={{ label: version.name, value: version.id }}
            onChange={(item) =>
              router.push(getStartedPath(item.value, flavor.value))
            }
          />
        </div>
        <div className="px-1 pt-3 sm:px-3 xl:px-5">
          <Selector
            data={flavorList}
            selected={flavor}
            onChange={(item) =>
              router.push(getStartedPath(version.id, item.value))
            }
          />
        </div>
        <div className="px-1 py-6 sm:px-3 xl:px-5 h-1 w-full border-b b-gray-200" />
        <nav
          data-testid="navigation"
          className="px-1 pt-1 overflow-y-auto font-medium text-base sm:px-3 xl:px-5 lg:text-sm pb-10 lg:pb-14 sticky?lg:h-(screen-18)"
        >
          {menu.sections.map((section) => (
            <SidebarSection key={section.id} section={section} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function SidebarSection({ section }: { section: MenuSection }) {
  return (
    <>
      {section.hideSectionHeader ? null : (
        <h4
          data-testid={`section-h4:${section.id}`}
          className="mt-6 mb-4 pb-2 text-m border-b border-gray-50 border-solid"
        >
          {section.name}
        </h4>
      )}
      <ul>
        <li className="mt-8">
          {section.itemList.map((item) => (
            <SidebarSectionItems key={item.id} item={item} />
          ))}
        </li>
      </ul>
    </>
  );
}

function SidebarSectionItems({ item }: { item: MenuItem }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(!item.disableCollapsible);

  const handleCollapseToggle = useCallback(() => {
    if (!item.disableCollapsible) {
      setCollapsed(!collapsed);
    }
  }, [collapsed, setCollapsed, item]);

  return (
    <>
      <h5
        data-testid={`section-h5:${item.id}`}
        className={cx(
          'flex my-2 py-2',
          'uppercase tracking-wide font-semibold text-sm lg:text-xs text-gray-900',
          item.disableCollapsible ? 'cursor-text' : 'cursor-pointer'
        )}
        onClick={handleCollapseToggle}
      >
        {item.name}
        {item.disableCollapsible ? null : (
          <CollapsibleIcon isCollapsed={collapsed} />
        )}
      </h5>
      <ul className={collapsed ? 'hidden' : ''}>
        {item.itemList.map((item) => {
          const isActiveLink = item.path === router?.asPath;
          return (
            <li key={item.id} data-testid={`section-li:${item.id}`}>
              <Link href={item.path}>
                <a
                  className={cx(
                    'p-2 transition-colors duration-200 relative block hover:text-gray-900'
                  )}
                >
                  {isActiveLink ? (
                    <span className="rounded-md absolute h-full w-2 right-2 top-0 bg-blue-nx-base" />
                  ) : null}
                  <span className="relative">{item.name}</span>
                </a>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CollapsibleIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cx(
        'transition-all h-3.5 w-3.5 text-gray-500',
        !isCollapsed && 'transform rotate-90'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={'M9 5l7 7-7 7'}
      />
    </svg>
  );
}

export default Sidebar;
