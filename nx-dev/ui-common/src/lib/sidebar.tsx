import { Dialog, Transition } from '@headlessui/react';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createRef, Fragment, useCallback, useEffect, useState } from 'react';

export interface SidebarProps {
  menu: Menu;
}
export interface FloatingSidebarProps {
  menu: Menu;
  navIsOpen: boolean;
}

export function Sidebar({ menu }: SidebarProps): JSX.Element {
  return (
    <div data-testid="navigation-wrapper">
      <nav
        id="nav"
        data-testid="navigation"
        className="pb-4 text-base lg:text-sm"
      >
        {menu.sections.map((section, index) => (
          <SidebarSection key={section.id + '-' + index} section={section} />
        ))}
      </nav>
    </div>
  );
}

function SidebarSection({ section }: { section: MenuSection }): JSX.Element {
  const router = useRouter();
  const itemList = section.itemList.map((i) => ({
    ...i,
    ref: createRef<HTMLDivElement>(),
  }));

  const currentItem = itemList.find((s) => router.asPath.includes(s.path));

  useEffect(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (currentItem && currentItem.ref.current)
          currentItem.ref.current.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    });
  }, [currentItem]);
  return (
    <>
      {section.hideSectionHeader ? null : (
        <h4
          data-testid={`section-h4:${section.id}`}
          className="mt-8 border-b border-solid border-slate-50 text-lg font-bold dark:border-slate-800 dark:text-slate-100"
        >
          {section.name}
        </h4>
      )}
      <ul>
        <li className="mt-2">
          {itemList
            .filter((i) => !!i.children?.length)
            .map((item, index) => (
              <div key={item.id + '-' + index} ref={item.ref}>
                <SidebarSectionItems key={item.id + '-' + index} item={item} />
              </div>
            ))}
        </li>
      </ul>
    </>
  );
}

function SidebarSectionItems({ item }: { item: MenuItem }): JSX.Element {
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
          'text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200 lg:text-xs',
          item.disableCollapsible ? 'cursor-text' : 'cursor-pointer'
        )}
        onClick={handleCollapseToggle}
      >
        {item.disableCollapsible ? (
          <Link href={item.path as string} className="hover:underline">
            {item.name}
          </Link>
        ) : (
          <>
            {item.name} <CollapsibleIcon isCollapsed={collapsed} />
          </>
        )}
      </h5>
      <ul className={cx('mb-6 ml-3', collapsed ? 'hidden' : '')}>
        {(item.children as MenuItem[]).map((subItem, index) => {
          const isActiveLink = subItem.path === withoutAnchors(router.asPath);
          if (isActiveLink && collapsed) {
            handleCollapseToggle();
          }

          return (
            <li
              key={subItem.id + '-' + index}
              data-testid={`section-li:${subItem.id}`}
            >
              {subItem.children.length ? (
                <SidebarSectionItems item={subItem} />
              ) : (
                <Link
                  href={subItem.path}
                  className={cx(
                    'relative block py-1 text-slate-500 transition-colors duration-200 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300'
                  )}
                >
                  <span
                    className={cx('relative', {
                      'text-md font-medium text-blue-500 dark:text-sky-500':
                        isActiveLink,
                    })}
                  >
                    {subItem.name}
                  </span>
                </Link>
              )}
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
}): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cx(
        'h-3.5 w-3.5 text-slate-600 transition-all dark:text-slate-400',
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

export function SidebarMobile({
  menu,
  navIsOpen,
}: FloatingSidebarProps): JSX.Element {
  const router = useRouter();
  const isNxCloud: boolean = router.asPath.startsWith('/nx-cloud');
  const isPackages: boolean = router.asPath.startsWith('/packages');
  const isPlugins: boolean = router.asPath.startsWith('/plugins');
  const isRecipes: boolean = router.asPath.startsWith('/recipes');
  const isNx: boolean = !isNxCloud && !isPackages && !isPlugins && !isRecipes;

  const sections = [
    { name: 'Home', href: '/', current: false },
    { name: 'Nx', href: '/getting-started/intro', current: isNx },
    {
      name: 'Nx Cloud',
      href: '/nx-cloud/intro/what-is-nx-cloud',
      current: isNxCloud,
    },
    {
      name: 'Packages',
      href: '/packages',
      current: isPackages,
    },
    {
      name: 'Plugins',
      href: '/plugins/intro/getting-started',
      current: isPlugins,
    },
    {
      name: 'Recipes',
      href: '/recipes',
      current: isRecipes,
    },
  ];
  return (
    <Transition.Root show={navIsOpen} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={() => void 0}>
        <div className="fixed inset-0 top-[57px] z-40 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative flex w-full flex-col overflow-y-auto bg-white p-4 dark:bg-slate-900">
              {/*SECTIONS*/}
              <div className="mb-8 grid w-full shrink-0 grid-cols-3 items-center justify-between">
                {sections.map((section) => (
                  <Link
                    key={section.name}
                    href={section.href}
                    className={cx(
                      section.current
                        ? 'text-blue-600 dark:text-sky-500'
                        : 'hover:text-slate-900 dark:hover:text-sky-400',
                      'whitespace-nowrap p-4 text-center text-sm font-medium'
                    )}
                    aria-current={section.current ? 'page' : undefined}
                  >
                    {section.name}
                  </Link>
                ))}
              </div>
              {/*SIDEBAR*/}
              <div data-testid="mobile-navigation-wrapper ">
                <nav
                  id="mobile-nav"
                  data-testid="mobile-navigation"
                  className="text-base lg:text-sm"
                >
                  {menu.sections.map((section, index) => (
                    <SidebarSection
                      key={section.id + '-' + index}
                      section={section}
                    />
                  ))}
                </nav>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
