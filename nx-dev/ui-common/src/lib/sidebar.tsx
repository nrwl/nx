'use client';
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AlgoliaSearch } from '@nx/nx-dev/feature-search';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev/models-menu';
import { iconsMap } from '@nx/nx-dev/ui-references';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createRef, Fragment, useCallback, useEffect, useState } from 'react';
import { NxIcon } from '@nx/nx-dev/ui-icons';

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
        {menu.sections.map((section, index) => {
          return (
            <SidebarSection
              key={section.id + '-' + index}
              section={section}
              isInTechnologiesPath={false}
            />
          );
        })}
      </nav>
    </div>
  );
}

function SidebarSection({
  section,
  isInTechnologiesPath,
}: {
  section: MenuSection;
  isInTechnologiesPath: boolean;
}): JSX.Element {
  const router = useRouter();

  // Get all items with refs
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
          className="mb-3 mt-8 border-b border-solid border-slate-200 pb-2 text-xl font-bold dark:border-slate-700 dark:text-slate-100"
        >
          {section.name}
        </h4>
      )}
      <ul>
        <li className="mt-2">
          {itemList
            .filter((i) => !!i.children?.length)
            .map((item, index) => {
              // Check if this specific item is the Technologies item
              const isTechnologiesItem = item.id === 'technologies';

              return (
                <div key={item.id + '-' + index} ref={item.ref}>
                  <SidebarSectionItems
                    key={item.id + '-' + index}
                    item={item}
                    isNested={false}
                    firstLevel={false} // Not needed at the top level
                    isInTechnologiesPath={isTechnologiesItem}
                  />
                </div>
              );
            })}
        </li>
      </ul>
    </>
  );
}

function SidebarSectionItems({
  item,
  isNested = false,
  isInTechnologiesPath = false,
  firstLevel = false,
}: {
  item: MenuItem;
  isNested?: boolean;
  isInTechnologiesPath?: boolean;
  firstLevel?: boolean;
}): JSX.Element {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(!item.disableCollapsible);

  // Check if this is the Technologies main item
  const isTechnologiesItem = item.id === 'technologies';

  // If this is direct child of the Technologies item, show an icon
  const isDirectTechnologyChild =
    isInTechnologiesPath && item.id !== 'technologies';

  // Get the icon key for this technology
  let iconKey = null;
  if (isDirectTechnologyChild) {
    iconKey = getIconKeyForTechnology(item.id);
  }

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

  // Update the children mapping to safely handle cases where item.children might be undefined
  const children = item.children || [];

  return (
    <>
      <h5
        data-testid={`section-h5:${item.id}`}
        className={cx(
          'group flex items-center py-2',
          isDirectTechnologyChild ? '-ml-1 px-1 ' : '',
          !isNested
            ? 'text-base font-semibold text-slate-800 lg:text-base dark:text-slate-200'
            : 'text-sm font-semibold text-slate-800 lg:text-sm dark:text-slate-200',
          item.disableCollapsible ? 'cursor-text' : 'cursor-pointer'
        )}
        onClick={handleCollapseToggle}
      >
        {isDirectTechnologyChild && (
          <div className="mr-2 flex h-6 w-6 flex-shrink-0 items-center justify-center">
            <img
              className="h-5 w-5 object-cover opacity-100 dark:invert"
              loading="lazy"
              src={iconsMap[iconKey || 'nx']}
              alt={item.name + ' illustration'}
              aria-hidden="true"
            />
          </div>
        )}
        <div className={cx('flex flex-grow items-center justify-between')}>
          {item.disableCollapsible ? (
            <Link
              href={item.path as string}
              className="hover:underline"
              prefetch={false}
            >
              {item.name}
            </Link>
          ) : (
            <>
              <span className={isDirectTechnologyChild ? 'flex-grow' : ''}>
                {item.name}
              </span>
              <CollapsibleIcon isCollapsed={collapsed} />
            </>
          )}
        </div>
      </h5>
      <ul className={cx('mb-6', collapsed ? 'hidden' : '')}>
        {children.map((subItem, index) => {
          const isActiveLink = withoutAnchors(router.asPath).startsWith(
            subItem.path
          );
          if (isActiveLink && collapsed) {
            handleCollapseToggle();
          }

          // Skip pl-3 for first level items, apply it to deeper nested levels
          const shouldApplyPadding = isNested && !firstLevel;

          return (
            <li
              key={subItem.id + '-' + index}
              data-testid={`section-li:${subItem.id}`}
              className={cx(
                'relative',
                shouldApplyPadding && 'pl-3', // Only apply padding for deeply nested items, not first level
                !isNested && 'pl-2 transition-colors duration-150', // Add pl-2 for padding between vertical bar and text
                !isNested && 'border-l-2',
                !isNested &&
                  (isActiveLink
                    ? 'border-l-blue-500 hover:border-l-blue-600 dark:border-l-sky-500 dark:hover:border-l-sky-400'
                    : 'border-l-transparent hover:border-blue-300 dark:border-l-transparent dark:hover:border-sky-400')
              )}
            >
              {(subItem.children || []).length ? (
                <SidebarSectionItems
                  item={subItem}
                  isNested={true}
                  firstLevel={!isNested} // Set firstLevel=true when coming from a top-level item
                  isInTechnologiesPath={isTechnologiesItem}
                />
              ) : (
                <Link
                  href={subItem.path}
                  className={cx(
                    'relative block py-1 text-slate-500 transition-colors duration-200 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300'
                  )}
                  prefetch={false}
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
  const isExtendingNx: boolean = router.asPath.startsWith('/extending-nx');
  const isPlugins: boolean = router.asPath.startsWith('/plugin-registry');
  const isChangelog: boolean = router.asPath.startsWith('/changelog');
  const isAiChat: boolean = router.asPath.startsWith('/ai-chat');
  const isNx: boolean =
    !isCI &&
    !isAPI &&
    !isExtendingNx &&
    !isPlugins &&
    !isChangelog &&
    !isAiChat;

  const sections = {
    general: [
      { name: 'Home', href: '/', current: false },
      { name: 'Blog', href: '/blog', current: false },
      { name: 'Resources', href: '/resources', current: false },
      { name: 'Nx Cloud', href: '/nx-cloud', current: false },
      {
        name: 'Powerpack',
        href: '/powerpack',
        current: false,
      },
      {
        name: 'Enterprise',
        href: '/enterprise',
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
        current: isExtendingNx,
      },
      {
        name: 'Plugins',
        href: '/plugin-registry',
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
    <Transition show={navIsOpen} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={() => void 0}>
        <div className="fixed inset-0 z-40 flex">
          <TransitionChild
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="relative flex w-full flex-col overflow-y-auto bg-white dark:bg-slate-900">
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
                    prefetch={false}
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
                        prefetch={false}
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
                        prefetch={false}
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
                        isInTechnologiesPath={false}
                      />
                    ))}
                  </nav>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function getIconKeyForTechnology(idOrName: string): string {
  // Normalize the input to lowercase for more reliable matching
  const normalized = idOrName.toLowerCase();

  // Technology icon mapping
  const technologyIconMap: Record<string, string> = {
    // JavaScript/TypeScript
    typescript: 'js',
    js: 'js',

    // Angular
    angular: 'angular',
    'angular-rspack': 'angular-rspack',
    'angular-rsbuild': 'angular-rsbuild',

    // React
    react: 'react',
    'react-native': 'react-native',
    remix: 'remix',
    next: 'next',
    expo: 'expo',

    // Vue
    vue: 'vue',
    nuxt: 'nuxt',

    // Node
    nodejs: 'node',
    'node.js': 'node',
    node: 'node',

    // Java
    java: 'gradle',
    gradle: 'gradle',

    // Module Federation
    'module-federation': 'module-federation',

    // Linting
    eslint: 'eslint',
    'eslint-technology': 'eslint',

    // Testing
    'testing-tools': 'jest',
    cypress: 'cypress',
    jest: 'jest',
    playwright: 'playwright',
    storybook: 'storybook',
    detox: 'detox',

    // Build tools
    'build-tools': 'webpack',
    'build tools': 'webpack',
    webpack: 'webpack',
    vite: 'vite',
    rollup: 'rollup',
    esbuild: 'esbuild',
    rspack: 'rspack',
    rsbuild: 'rsbuild',
  };

  // Return the mapped icon or 'nx' as default
  return technologyIconMap[normalized] || 'nx';
}
