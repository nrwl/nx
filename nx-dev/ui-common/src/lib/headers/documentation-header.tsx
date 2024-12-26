'use client';
import { Fragment, type JSX } from 'react';

import { GitHubIcon } from '@nx/nx-dev/ui-icons';
import {
  Bars3Icon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AlgoliaSearch } from '@nx/nx-dev/feature-search';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ButtonLink } from '../button';
import { Popover, Transition } from '@headlessui/react';
import { TwoColumnsMenu } from './two-columns-menu';
import {
  companyItems,
  eventItems,
  featuresItems,
  learnItems,
  ossProducts,
  resourceMenuItems,
  productsMenuItems,
} from './menu-items';
import { SectionsMenu } from './sections-menu';
import { DiscordIcon } from '../discord-icon';
import { NxCloudAnimatedIcon, NxIcon } from '@nx/nx-dev/ui-icons';

function Menu({ tabs }: { tabs: any[] }): JSX.Element {
  return (
    <div className="hidden sm:block">
      <nav
        role="documentation-nav"
        aria-label="Tabs"
        className="-mb-px flex gap-6"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.name}
            href={tab.href}
            className={cx(
              tab.current
                ? 'border-blue-500 text-blue-600 dark:border-sky-500 dark:text-sky-500'
                : 'border-transparent hover:text-slate-900 dark:hover:text-sky-400',
              'whitespace-nowrap border-b-2 py-2 text-sm font-medium'
            )}
            aria-current={tab.current ? 'page' : undefined}
            prefetch={false}
          >
            {tab.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function DocumentationHeader({
  isNavOpen,
  toggleNav,
}: {
  isNavOpen: boolean;
  toggleNav: (value: boolean) => void;
}): JSX.Element {
  const router = useRouter();
  let routerPath = router.asPath;
  const isCI: boolean = routerPath.startsWith('/ci');
  const isAPI: boolean = routerPath.startsWith('/nx-api');
  const isExtendingNx: boolean = routerPath.startsWith('/extending-nx');
  const isPlugins: boolean = routerPath.startsWith('/plugin-registry');
  const isChangelog: boolean = routerPath.startsWith('/changelog');
  const isAiChat: boolean = router.asPath.startsWith('/ai-chat');
  const isNx: boolean =
    !isCI &&
    !isAPI &&
    !isExtendingNx &&
    !isPlugins &&
    !isChangelog &&
    !isAiChat;

  const sections = [
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
  ];

  const communityLinks = [
    {
      name: 'Discord',
      label: 'Community channel',
      href: 'https://go.nx.dev/community',
      icon: (props: any) => <DiscordIcon {...props} />,
    },
    {
      name: 'X',
      label: 'Latest news',
      href: 'https://x.com/NxDevTools?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>X</title>*/}
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      ),
    },
    {
      name: 'Bluesky',
      label: 'Latest news on Bluesky',
      href: 'https://bsky.app/profile/nx.dev?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>Bluesky</title>*/}
          <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
        </svg>
      ),
    },
    {
      name: 'Youtube',
      label: 'Youtube channel',
      href: 'https://www.youtube.com/@NxDevtools?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          {/*<title>YouTube</title>*/}
          <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14c-1.88-.5-9.38-.5-9.38-.5s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z" />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      label: 'Nx is open source, check the code on GitHub',
      href: 'https://github.com/nrwl/nx?utm_source=nx.dev',
      icon: (props: any) => (
        <svg
          fill="currentColor"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          {...props}
        >
          {/*<title>GitHub</title>*/}
          <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8a8 8 0 0 0-8-8z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 print:hidden">
      <div className="mx-auto flex w-full items-center gap-6 lg:px-8 lg:py-4">
        {/*MOBILE MENU*/}
        <div className="flex w-full items-center lg:hidden">
          <button
            type="button"
            className="flex px-4 py-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => toggleNav(!isNavOpen)}
          >
            <span className="sr-only">Open sidebar</span>
            {isNavOpen ? (
              <XMarkIcon className="mr-3 h-6 w-6" />
            ) : (
              <Bars3Icon className="mr-3 h-6 w-6" aria-hidden="true" />
            )}
            <span className="font-medium">
              {sections.find((x) => x.current)?.name}
            </span>
          </button>

          {/*SEARCH*/}
          <div className="mx-4 w-auto">
            <AlgoliaSearch />
          </div>
        </div>
        {/*LOGO*/}
        <div className="flex items-center">
          <Link
            href="/"
            className="flex flex-grow items-center px-4 text-slate-900 lg:px-0 dark:text-white"
            prefetch={false}
          >
            <span className="sr-only">Nx</span>
            <NxIcon aria-hidden="true" className="h-8 w-8" />
          </Link>
          <Link
            href="/getting-started/intro"
            className="ml-2 hidden items-center px-4 text-slate-900 lg:flex lg:px-0 dark:text-white"
            prefetch={false}
          >
            <span className="text-xl font-bold uppercase tracking-wide">
              Docs
            </span>
          </Link>
        </div>
        {/*SEARCH*/}
        <div className="hidden w-full max-w-[14rem] lg:inline">
          <AlgoliaSearch />
        </div>
        {/*NAVIGATION*/}
        <div className="hidden flex-shrink-0 xl:flex">
          <nav
            role="menu"
            className="items-justified hidden justify-center space-x-2 text-sm lg:flex"
          >
            <h2 className="sr-only">Main navigation</h2>
            <Link
              href="/blog"
              title="Blog"
              className="hidden px-3 py-2 font-medium leading-tight hover:text-blue-500 md:inline-flex dark:text-slate-200 dark:hover:text-sky-500"
              prefetch={false}
            >
              Blog
            </Link>
            {/*RESOURCES*/}
            <Popover className="relative">
              {({ open }) => (
                <>
                  <Popover.Button
                    className={cx(
                      open ? 'text-blue-500 dark:text-sky-500' : '',
                      'group inline-flex items-center px-3 py-2 font-medium leading-tight outline-0 dark:text-slate-200'
                    )}
                  >
                    <span className="transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500">
                      Resources
                    </span>
                    <ChevronDownIcon
                      className={cx(
                        open
                          ? 'rotate-180 transform text-blue-500 dark:text-sky-500'
                          : '',
                        'ml-2 h-3 w-3 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500'
                      )}
                      aria-hidden="true"
                    />
                  </Popover.Button>

                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="opacity-0 translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-150"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-1"
                  >
                    <Popover.Panel className="absolute left-60 z-30 mt-3 w-max max-w-2xl -translate-x-1/2 transform lg:left-20">
                      <SectionsMenu sections={resourceMenuItems} />
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
            <div className="hidden h-6 w-px bg-slate-200 md:block dark:bg-slate-700" />
            <Link
              href="/nx-cloud"
              title="Nx Cloud"
              className="hidden gap-2 px-3 py-2 font-medium leading-tight hover:text-blue-500 md:inline-flex dark:text-slate-200 dark:hover:text-sky-500"
              prefetch={false}
            >
              Nx Cloud
            </Link>
            <Link
              href="/pricing"
              title="Pricing"
              className="hidden gap-2 px-3 py-2 font-medium leading-tight hover:text-blue-500 md:inline-flex dark:text-slate-200 dark:hover:text-sky-500"
              prefetch={false}
            >
              Pricing
            </Link>
            <div className="hidden h-6 w-px bg-slate-200 md:block dark:bg-slate-700" />
            <Link
              href="/powerpack"
              title="Nx Powerpack"
              className="hidden gap-2 px-3 py-2 font-medium leading-tight hover:text-blue-500 md:inline-flex dark:text-slate-200 dark:hover:text-sky-500"
              prefetch={false}
            >
              Powerpack
            </Link>
            <Link
              href="/enterprise"
              title="Nx Enterprise"
              className="hidden gap-2 px-3 py-2 font-medium leading-tight hover:text-blue-500 md:inline-flex dark:text-slate-200 dark:hover:text-sky-500"
              prefetch={false}
            >
              Enterprise
            </Link>
          </nav>
        </div>
        <div className="hidden flex-grow lg:flex">{/* SPACER */}</div>
        <div className="hidden flex-shrink-0 lg:flex">
          <nav
            role="menu"
            className="items-justified hidden justify-center space-x-4 lg:flex"
          >
            <ButtonLink
              href="/nx-cloud"
              title="Try Nx Cloud for free"
              variant="primary"
              size="small"
            >
              <NxCloudAnimatedIcon className="h-4 w-4" aria-hidden="true" />
              <span>Try Nx Cloud for free</span>
            </ButtonLink>
          </nav>
        </div>
      </div>
      <div className="mx-auto hidden w-full items-center px-4 sm:space-x-10 sm:px-6 lg:flex lg:px-8">
        <Menu tabs={sections} />
        <div className="flex-grow"></div>
        <nav
          aria-labelledby="community-links"
          className="block min-w-36 space-x-2 text-right"
        >
          {communityLinks.map((item) => (
            <a
              key={item.name}
              title={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex p-1"
            >
              <span className="sr-only">{item.label}</span>
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
