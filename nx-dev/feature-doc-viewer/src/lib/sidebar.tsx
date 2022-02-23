import {
  Menu,
  MenuItem,
  MenuSection,
} from '@nrwl/nx-dev/data-access-documents';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactComponentElement, useCallback, useState } from 'react';

export interface SidebarProps {
  menu: Menu;
  navIsOpen?: boolean;
}

export function Sidebar({
  menu,
  navIsOpen,
}: SidebarProps): ReactComponentElement<any> {
  return (
    <div
      data-testid="sidebar"
      className={cx(
        'lg:pt-o fixed inset-0 z-20 h-full w-full flex-none border-r border-gray-50 bg-black bg-opacity-25 lg:static lg:block lg:h-auto lg:w-64 lg:overflow-y-visible lg:bg-white',
        !navIsOpen && 'hidden',
        navIsOpen && 'block'
      )}
    >
      <div
        data-testid="navigation-wrapper"
        className="scrolling-touch lg:top-18 mr-24 h-full overflow-auto overflow-y-auto bg-white px-2 sm:pr-4 lg:relative lg:sticky lg:mr-0 lg:block lg:h-auto lg:bg-transparent xl:pr-6"
      >
        <div className="pointer-events-none absolute inset-x-0 z-10 hidden h-12 bg-gradient-to-b from-white lg:block" />

        <nav
          id="nav"
          data-testid="navigation"
          className="sticky?lg:h-(screen-18) px-1 pt-16 pb-10 text-base font-medium sm:px-3 lg:pb-14 lg:text-sm xl:px-5"
        >
          {menu.sections.map((section, index) => (
            <SidebarSection key={section.id + '-' + index} section={section} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function SidebarSection({
  section,
}: {
  section: MenuSection;
}): ReactComponentElement<any> {
  return (
    <>
      {section.hideSectionHeader ? null : (
        <h4
          data-testid={`section-h4:${section.id}`}
          className="mt-8 border-b border-solid border-gray-50 text-lg font-bold"
        >
          {section.name}
        </h4>
      )}
      <ul>
        <li className="mt-2">
          {section.itemList.map((item, index) => (
            <SidebarSectionItems key={item.id + '-' + index} item={item} />
          ))}
        </li>
      </ul>
    </>
  );
}

function SidebarSectionItems({
  item,
}: {
  item: MenuItem;
}): ReactComponentElement<any> {
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
          'text-sm font-semibold uppercase tracking-wide text-gray-900 lg:text-xs',
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
        {(item.itemList as MenuItem[]).map((item, index) => {
          const isActiveLink = item.path === withoutAnchors(router?.asPath);
          return (
            <li
              key={item.id + '-' + index}
              data-testid={`section-li:${item.id}`}
            >
              <Link href={item.path as string}>
                <a
                  className={cx(
                    'relative block py-1 text-gray-500 transition-colors duration-200 hover:text-gray-900'
                  )}
                >
                  {isActiveLink ? (
                    <span className="bg-blue-nx-base absolute -right-2 top-0 h-full w-1 rounded-md sm:-right-4" />
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

function CollapsibleIcon({
  isCollapsed,
}: {
  isCollapsed: boolean;
}): ReactComponentElement<any> {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cx(
        'h-3.5 w-3.5 text-gray-500 transition-all',
        !isCollapsed && 'rotate-90 transform'
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
