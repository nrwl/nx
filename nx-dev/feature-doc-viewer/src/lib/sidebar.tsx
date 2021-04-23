import React from 'react';
import cx from 'classnames';
import Link from 'next/link';
import { Menu, MenuItem, MenuSection } from '@nrwl/nx-dev/data-access-menu';
import { useRouter } from 'next/router';

export interface SidebarProps {
  menu: Menu;
}

export function Sidebar({ menu }: SidebarProps) {
  return (
    <div
      data-testid="sidebar"
      className="fixed z-40 inset-0 flex-none h-full bg-black bg-opacity-25 w-full lg:bg-white lg:static lg:h-auto lg:overflow-y-visible lg:pt-o lg:w-60 xl:w-72 lg:block hidden"
    >
      <div
        data-testid="navigation-wrapper"
        className="h-full overflow-y-auto scrolling-touch lg:h-auto lg:block lg:relative lg:sticky lg:bg-transparent overflow-hidden lg:top-18 bg-white mr-24 lg:mr-0"
      >
        <div className="hidden lg:block h-12 pointer-events-none absolute inset-x-0 z-10 bg-gradient-to-b from-white" />
        <nav
          data-testid="navigation"
          className="px-1 pt-6 overflow-y-auto font-medium text-base sm:px-3 xl:px-5 lg:text-sm pb-10 lg:pt-10 lg:pb-14 sticky?lg:h-(screen-18)"
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
      <h4 className="mt-6 mb-4 pb-2 border-b border-gray-50 border-solid">
        {section.name}
      </h4>
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

  return (
    <>
      <h5
        className={cx(
          'mt-3 mb-3 lg:mb-3',
          'uppercase tracking-wide font-semibold text-sm lg:text-xs text-gray-900'
        )}
      >
        {item.name}
      </h5>
      <ul>
        {item.itemList.map((item) => {
          const isActiveLink = item.path === router.asPath;
          return (
            <li key={item.id}>
              <Link href={item.path}>
                <a
                  className={cx(
                    'py-2 transition-colors duration-200 relative block',
                    isActiveLink
                      ? 'hover:text-blue-900 text-blue-500'
                      : 'hover:text-gray-900 text-gray-700'
                  )}
                >
                  {isActiveLink ? (
                    <span className="rounded-md absolute inset-0 bg-blue-50" />
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

export default Sidebar;
