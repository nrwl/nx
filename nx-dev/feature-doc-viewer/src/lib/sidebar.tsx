import React, { useCallback, useState } from 'react';
import cx from 'classnames';
import Link from 'next/link';
import {
  FlavorMetadata,
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
  flavorList: FlavorMetadata[];
  flavor: FlavorMetadata;
  navIsOpen?: boolean;
}

// Exported for testing
export function createNextPath(
  version: string,
  flavor: string,
  currentPath: string
): string {
  const genericPath = currentPath.split('/').slice(3).join('/');
  return `/${version}/${flavor}/${genericPath}`;
}

export function Sidebar({
  flavor,
  flavorList,
  version,
  versionList,
  menu,
  navIsOpen,
}: SidebarProps) {
  const router = useRouter();
  return (
    <div
      data-testid="sidebar"
      className={cx(
        'fixed z-40 inset-0 flex-none h-full bg-black bg-opacity-25 w-full lg:bg-white lg:static lg:h-auto lg:overflow-y-visible lg:pt-o lg:w-64 lg:block border-r border-gray-50',
        !navIsOpen && 'hidden',
        navIsOpen && 'block'
      )}
    >
      <div
        data-testid="navigation-wrapper"
        className="h-full overflow-y-auto scrolling-touch lg:h-auto lg:block lg:relative lg:sticky lg:bg-transparent overflow-auto lg:top-18 bg-white mr-24 lg:mr-0 px-2 sm:pr-4 xl:pr-6"
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
              router.push(createNextPath(item.value, flavor.id, router.asPath))
            }
          />
        </div>
        <div className="px-1 pt-3 sm:px-3 xl:px-5">
          <Selector
            data={flavorList.map((flavor) => ({
              label: flavor.name,
              value: flavor.id,
            }))}
            selected={{ label: flavor.name, value: flavor.id }}
            onChange={(item) =>
              router.push(createNextPath(version.id, item.value, router.asPath))
            }
          />
        </div>
        <div className="px-1 py-6 sm:px-3 xl:px-5 h-1 w-full border-b border-gray-50" />
        <nav
          id="nav"
          data-testid="navigation"
          className="px-1 pt-1 font-medium text-base sm:px-3 xl:px-5 lg:text-sm pb-10 lg:pb-14 sticky?lg:h-(screen-18)"
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
          className="mt-8 text-lg font-bold border-b border-gray-50 border-solid"
        >
          {section.name}
        </h4>
      )}
      <ul>
        <li className="mt-2">
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

  function withoutAnchors(linkText: string): string {
    return linkText?.includes('#')
      ? linkText.substring(0, linkText.indexOf('#'))
      : linkText;
  }

  return (
    <>
      <h5
        data-testid={`section-h5:${item.id}`}
        className={cx(
          'flex py-2',
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
      <ul className={cx('mb-6', collapsed ? 'hidden' : '')}>
        {item.itemList.map((item) => {
          const isActiveLink = item.path === withoutAnchors(router?.asPath);
          return (
            <li key={item.id} data-testid={`section-li:${item.id}`}>
              <Link href={item.path as string}>
                <a
                  className={cx(
                    'py-1 transition-colors duration-200 relative block text-gray-500 hover:text-gray-900'
                  )}
                >
                  {isActiveLink ? (
                    <span className="rounded-md absolute h-full w-1 -right-2 sm:-right-4 top-0 bg-green-nx-base" />
                  ) : null}
                  <span
                    className={cx('relative', {
                      'text-gray-900': isActiveLink,
                    })}
                  >
                    {item.name}
                  </span>
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
