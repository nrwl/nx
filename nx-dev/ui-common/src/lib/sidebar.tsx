'use client';
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AlgoliaSearch } from '@nx/nx-dev-feature-search';
import { Menu, MenuItem, MenuSection } from '@nx/nx-dev-models-menu';
import { iconsMap } from '@nx/nx-dev-ui-references';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  createRef,
  Fragment,
  type JSX,
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import { NxIcon } from '@nx/nx-dev-ui-icons';

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
            <SidebarSection key={section.id + '-' + index} section={section} />
          );
        })}
      </nav>
    </div>
  );
}

function SidebarSection({ section }: { section: MenuSection }): JSX.Element {
  // Get all items with refs
  const itemList = section.itemList.map((i) => ({
    ...i,
    ref: createRef<HTMLDivElement>(),
  }));

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
              return (
                <div key={item.id + '-' + index} ref={item.ref}>
                  <SidebarSectionItems
                    key={item.id + '-' + index}
                    item={item}
                    isNested={false}
                    firstLevel={true}
                  />
                </div>
              );
            })}
        </li>
      </ul>
    </>
  );
}

function withoutAnchors(linkText: string): string {
  return linkText?.includes('#')
    ? linkText.substring(0, linkText.indexOf('#'))
    : linkText;
}

function SidebarSectionItems({
  item,
  isNested,
  icon,
  firstLevel,
}: {
  item: MenuItem;
  isNested?: boolean;
  icon?: string;
  firstLevel?: boolean;
}): JSX.Element {
  const router = useRouter();
  const initialRender = useRef(true);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCurrentPath(router.asPath);
  }, [router.asPath]);

  const isActiveLink = isClient
    ? withoutAnchors(currentPath).startsWith(item.path)
    : false;
  const [collapsed, setCollapsed] = useState(
    !item.disableCollapsible && !isActiveLink
  );

  const handleCollapseToggle = useCallback(() => {
    if (!item.disableCollapsible) {
      setCollapsed(!collapsed);
    }
  }, [collapsed, setCollapsed, item]);

  // Update the children mapping to safely handle cases where item.children might be undefined
  const children = item.children || [];

  return (
    <>
      <h5
        data-testid={`section-h5:${item.id}`}
        className={cx(
          'group flex items-center py-2',
          '-ml-1 px-1 ',
          !isNested
            ? 'text-base text-slate-800 lg:text-base dark:text-slate-200'
            : 'text-sm text-slate-800 lg:text-sm dark:text-slate-200',
          firstLevel ? 'font-semibold' : '',
          item.disableCollapsible ? 'cursor-text' : 'cursor-pointer'
        )}
        onClick={handleCollapseToggle}
      >
        {icon && (
          <div className="mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <img
              className="h-4 w-4 object-cover opacity-100 dark:invert"
              loading="lazy"
              src={iconsMap[icon || 'nx']}
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
              <span className={icon ? 'flex-grow' : ''}>{item.name}</span>
              <CollapsibleIcon isCollapsed={collapsed} />
            </>
          )}
        </div>
      </h5>
      <ul className={collapsed ? 'hidden' : ''}>
        {children.map((subItem, index) => {
          const isActiveLink = isClient
            ? withoutAnchors(currentPath).startsWith(subItem.path)
            : false;
          if (isActiveLink && collapsed && initialRender.current) {
            handleCollapseToggle();
          }

          initialRender.current = false;

          return (
            <li
              key={subItem.id + '-' + index}
              data-testid={`section-li:${subItem.id}`}
              className={cx(
                'relative',
                item.id !== 'technologies'
                  ? 'border-l border-slate-300 pl-2 pl-3 transition-colors duration-150 dark:border-slate-600'
                  : ''
              )}
            >
              {(subItem.children || []).length ? (
                <SidebarSectionItems
                  item={subItem}
                  firstLevel={false}
                  isNested={true}
                  icon={
                    item.id === 'technologies'
                      ? getIconKeyForTechnology(subItem.id)
                      : undefined
                  }
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
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCurrentPath(router.asPath);
  }, [router.asPath]);

  const isCI: boolean = isClient && currentPath.startsWith('/ci');
  const isAPI: boolean = isClient && currentPath.startsWith('/nx-api');
  const isExtendingNx: boolean =
    isClient && currentPath.startsWith('/extending-nx');
  const isPlugins: boolean =
    isClient && currentPath.startsWith('/plugin-registry');
  const isChangelog: boolean = isClient && currentPath.startsWith('/changelog');
  const isAiChat: boolean = isClient && currentPath.startsWith('/ai-chat');
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
      {
        name: 'Nx',
        href: process.env.NEXT_PUBLIC_ASTRO_URL
          ? '/docs/getting-started/intro'
          : '/getting-started/intro',
        current: isNx,
      },
      {
        name: 'CI',
        href: process.env.NEXT_PUBLIC_ASTRO_URL
          ? '/docs/features/ci-features'
          : '/ci/features',
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
                {process.env.NEXT_PUBLIC_ASTRO_URL ? null : (
                  <div className="mx-4 w-auto">
                    <AlgoliaSearch />
                  </div>
                )}
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

const technologyIconMap: Record<string, string> = {
  // JavaScript/TypeScript
  typescript: 'ts',
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
  java: 'java',
  gradle: 'gradle',

  // Module Federation
  'module-federation': 'module-federation',

  // Linting
  eslint: 'eslint',
  'eslint-technology': 'eslint',

  // Testing
  'test-tools': 'testtools',
  cypress: 'cypress',
  jest: 'jest',
  playwright: 'playwright',
  storybook: 'storybook',
  detox: 'detox',

  'build-tools': 'buildtools',
  webpack: 'webpack',
  vite: 'vite',
  rollup: 'rollup',
  esbuild: 'esbuild',
  rspack: 'rspack',
  rsbuild: 'rsbuild',
};

function getIconKeyForTechnology(idOrName: string): string {
  const normalized = idOrName.toLowerCase();
  return technologyIconMap[normalized] || 'nx';
}
