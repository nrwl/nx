'use client';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AlgoliaSearch } from '@nx/nx-dev/feature-search';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createRef, Fragment, useCallback, useEffect, useState } from 'react';
import { NxIcon } from './nx-icon';

export interface SidebarProps {
  menu: Menu;
}
export interface FloatingSidebarProps {
  menu: Menu;
  navIsOpen: boolean;
  toggleNav: (open: boolean) => void;
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
          'text-sm font-semibold uppercase tracking-wide text-slate-800 lg:text-xs dark:text-slate-200',
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
          const isActiveLink = withoutAnchors(router.asPath).startsWith(
            subItem.path
          );
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
        'w-3.5 text-slate-600 transition-all dark:text-slate-400',
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
  toggleNav,
}: FloatingSidebarProps): JSX.Element {
  const router = useRouter();
  const isCI: boolean = router.asPath.startsWith('/ci');
  const isAPI: boolean = router.asPath.startsWith('/nx-api');
  const isPlugins: boolean = router.asPath.startsWith('/extending-nx');
  const isChangelog: boolean = router.asPath.startsWith('/changelog');
  const isAiChat: boolean = router.asPath.startsWith('/ai-chat');
  const isNx: boolean =
    !isCI && !isAPI && !isPlugins && !isChangelog && !isAiChat;

  const sections = {
    general: [
      { name: 'Home', href: '/', current: false },
      { name: 'Blog', href: '/blog', current: false },
      { name: 'Community', href: '/community', current: false },
      { name: 'Launch Nx', href: '/launch-nx', current: false },
      {
        name: 'Contact',
        href: '/contact',
        current: false,
      },
      {
        name: 'Go to app',
        href: 'https://cloud.nx.app',
        current: false,
      },
    ],
    documentation: [
      { name: 'Nx', href: '/getting-started/intro', current: isNx },
      {
        name: 'CI',
        href: '/ci/intro/ci-with-nx',
        current: isCI,
      },
      {
        name: 'Extending Nx',
        href: '/extending-nx/intro/getting-started',
        current: isPlugins,
      },
      {
        name: 'API',
        href: '/nx-api',
        current: isAPI,
      },
      {
        name: 'Changelog',
        href: '/changelog',
        current: isChangelog,
      },
      {
        name: 'AI Chat',
        href: '/ai-chat',
        current: isAiChat,
      },
    ],
  };

  return (
    <Transition.Root show={navIsOpen} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={() => void 0}>
        <div className="fixed inset-0 z-40 flex">
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative flex w-full flex-col overflow-y-auto bg-white dark:bg-slate-900">
              {/*HEADER*/}
              <div className="flex w-full items-center border-b border-slate-200 bg-slate-50 p-4 lg:hidden dark:border-slate-700 dark:bg-slate-800/60">
                {/*CLOSE BUTTON*/}
                <button
                  type="button"
                  className="flex focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                  onClick={() => toggleNav(!navIsOpen)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon className="mr-3 h-6 w-6" />
                </button>

                {/*SEARCH*/}
                <div className="mx-4 w-auto">
                  <AlgoliaSearch />
                </div>
                {/*LOGO*/}
                <div className="ml-auto flex items-center">
                  <Link
                    href="/"
                    className="flex flex-grow items-center px-4 text-slate-900 lg:px-0 dark:text-white"
                  >
                    <span className="sr-only">Nx</span>
                    <NxIcon aria-hidden="true" className="h-8 w-8" />
                  </Link>
                </div>
              </div>
              <div className="p-4">
                {/*SECTIONS*/}
                <div className="mt-5 divide-y divide-slate-200">
                  <div className="grid w-full shrink-0 grid-cols-3 items-center justify-between">
                    {sections.general.map((section) => (
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
                  <div className="grid w-full shrink-0 grid-cols-3 items-center justify-between">
                    {sections.documentation.map((section) => (
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
                </div>
                {/*SIDEBAR*/}
                <div data-testid="mobile-navigation-wrapper" className="mt-8">
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
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
