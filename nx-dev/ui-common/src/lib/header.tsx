import { Dialog, Menu, Popover, Transition } from '@headlessui/react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  Bars4Icon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AlgoliaSearch } from '@nx/nx-dev/feature-search';
import cx from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Fragment, useEffect, useState } from 'react';
import { headerMenuIcons } from './header-icons';
import { ButtonLink } from './button';

export function Header(): JSX.Element {
  let [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // We need to close the popover if the route changes or the window is resized to prevent the popover from being stuck open.
  const checkSizeAndClosePopover = () => {
    const breakpoint = 1024; // This is the standard Tailwind lg breakpoint value
    if (window.innerWidth < breakpoint) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    window.addEventListener('resize', checkSizeAndClosePopover);

    return () => {
      window.removeEventListener('resize', checkSizeAndClosePopover);
    };
  }, []);

  const flyoutMobileMenu = [
    // {
    //   name: 'Getting started',
    //   description: 'Jump right in and start building!',
    //   href: '/getting-started/intro',
    // },
    {
      name: 'Docs',
      description: 'Latest news from the Nx & Nx Cloud core team',
      href: '/getting-started/intro',
    },
    {
      name: 'CI Pricing',
      href: 'https://nx.app/pricing',
    },
    // {
    //   name: 'Community',
    //   description: 'Check how to reach out and be part of the Nx community.',
    //   href: '/community',
    // },
    // {
    //   name: 'Launch Nx',
    //   description: 'A week of exciting announcements about Nx and Nx Cloud!',
    //   href: '/launch-nx',
    // },
    // {
    //   name: 'Contact us',
    //   description: 'Give us a call!',
    //   href: 'https://nx.app/enterprise?utm_source=nx.dev&utm_medium=header-menu',
    // },
  ];

  const flyOutMenuFeaturesOSS = [
    {
      name: 'Task Running',
      description: 'Maximize your CI/CD pipeline.',
      href: '/features/run-tasks',
      icon: headerMenuIcons['task-running'].image,
    },
    {
      name: 'Local Caching',
      description: 'Speed up your development by caching.',
      href: '/features/cache-task-results',
      icon: headerMenuIcons['local-caching'].image,
    },
    // {
    //   name: 'Nx Graph',
    //   description: 'Visualize structure and dependencies.',
    //   href: '/features/nx-graph',
    //   icon: 'nx-graph',
    // },
    {
      name: 'Automated Updating',
      description: 'Keep your dependecies up to date using Nx.',
      href: '/features/automate-updating-dependencies',
      icon: headerMenuIcons['automatic-update'].image,
    },
    {
      name: 'Module Boundaries',
      description: 'Define and enforce module boundaries.',
      href: '/features/enforce-module-boundaries',
      icon: headerMenuIcons['module-boundary'].image,
    },
    {
      name: 'Nx Release',
      description: 'Automate your release process with Nx.',
      href: '/features/manage-releases',
      icon: headerMenuIcons['nx-release'].image,
    },
    // {
    //   name: 'IDE Integration',
    //   description: 'Use Nx in your favorite IDE.',
    //   href: '/features/ide-integration',
    //   icon: 'ide-integration',
    // },
  ];

  const flyOutMenuFeaturesCI = [
    {
      name: 'Nx Replay',
      description: 'Replay previously executed tasks.',
      href: '/ci/features/remote-cache#use-remote-caching-nx-replay',
      icon: headerMenuIcons['replay'].image,
    },
    {
      name: 'Nx Agents',
      description: 'Distribute tasks across multiple agents.',
      href: '/ci/features/distribute-task-execution',
      icon: headerMenuIcons['agent'].image,
    },
    {
      name: 'Atomizer',
      description: 'Use Nx to optimize your E2E tests.',
      href: '/ci/features/split-e2e-tasks',
      icon: headerMenuIcons['atomizer'].image,
    },
  ];

  const flyOutMenuSolutions = [
    {
      name: 'Startups',
      description: 'How Nx can help your startup grow.',
      href: 'https://nx.app/pricing#plans',
    },
    {
      name: 'Pro',
      description: 'How Nx can help your organization scale.',
      href: 'https://nx.app/pricing#plans',
    },
    {
      name: 'Enterprise',
      description: 'How Nx can help your enterprise evolve.',
      href: 'https://nx.app/enterprise',
    },
  ];

  const flyOutMenuSolutionsUseCases = [
    {
      name: 'AI Apps',
      description: 'Build AI applications with Nx.',
      href: '',
    },
    {
      name: 'Composable Apps',
      description: 'Build composable applications with Nx.',
      href: '',
    },
    {
      name: 'Web Apps',
      description: 'Lightning speed with Nx.',
      href: '',
    },
    {
      name: 'Platform Engineering',
      description: 'Nx for platform engineering.',
      href: '',
    },
  ];

  const flyOutMenuResources = [
    {
      name: 'Nx Plugins',
      description: 'Discover Nx plugins to help you build faster.',
      href: '/plugin-registry',
    },
    {
      name: 'Youtube',
      description: 'Watch our latest videos on Youtube.',
      href: 'https://www.youtube.com/@nxdevtools',
    },
    {
      name: 'Community',
      description: 'Join the Nx community.',
      href: '/community',
    },
    {
      name: 'Newsletter',
      description: 'Stay up to date with the latest Nx news.',
      href: 'https://go.nrwl.io/nx-newsletter',
    },
  ];

  const flyOutMenuResourcesEvents = [
    {
      name: 'Nx Conf',
      description: 'The official Nx conference.',
      href: '/conf',
    },
    {
      name: 'Nx Launch Week',
      description: 'A week of exciting announcements about Nx and Nx Cloud!',
      href: '/launch-nx',
    },
    // {
    //   name: 'Talks by Nx Members',
    //   description: 'Watch talks by Nx members.',
    //   href: 'https://www.youtube.com/playlist?list=PLakNactNC1dGq93RSekGUHM8v-lirD4LZ',
    // },
  ];

  const flyOutMenuResourcesAboutUs = [
    {
      name: 'Blog',
      description: 'Latest news from the Nx & Nx Cloud core team',
      href: '/blog',
    },
    // {
    //   name: 'Nx Champions',
    //   description: 'Meet the Nx Champions.',
    //   href: '/community#nx-champions',
    // },
    {
      name: 'Nx Conf',
      description: 'The official Nx conference.',
      href: '/conf',
    },
  ];

  return (
    <div className="relative flex print:hidden">
      {/*DESKTOP*/}
      <div className="mx-auto hidden w-full max-w-7xl items-center justify-between space-x-10 p-4 px-8 lg:flex">
        {/*PRIMARY NAVIGATION*/}
        <div className="flex flex-shrink-0 text-sm">
          {/*LOGO*/}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center text-slate-900 dark:text-white mr-4"
            >
              <svg
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8"
                fill="currentColor"
              >
                <title>Nx</title>
                <path d="m12 14.1-3.1 5-5.2-8.5v8.9H0v-15h3.7l5.2 8.9v-4l3 4.7zm.6-5.7V4.5H8.9v3.9h3.7zm5.6 4.1a2 2 0 0 0-2 1.3 2 2 0 0 1 2.4-.7c.4.2 1 .4 1.3.3a2.1 2.1 0 0 0-1.7-.9zm3.4 1c-.4 0-.8-.2-1.1-.6l-.2-.3a2.1 2.1 0 0 0-.5-.6 2 2 0 0 0-1.2-.3 2.5 2.5 0 0 0-2.3 1.5 2.3 2.3 0 0 1 4 .4.8.8 0 0 0 .9.3c.5 0 .4.4 1.2.5v-.1c0-.4-.3-.5-.8-.7zm2 1.3a.7.7 0 0 0 .4-.6c0-3-2.4-5.5-5.4-5.5a5.4 5.4 0 0 0-4.5 2.4l-1.5-2.4H8.9l3.5 5.4L9 19.5h3.6L14 17l1.6 2.4h3.5l-3.1-5a.7.7 0 0 1 0-.3 2.7 2.7 0 0 1 2.6-2.7c1.5 0 1.7.9 2 1.3.7.8 2 .5 2 1.5a.7.7 0 0 0 1 .6zm.4.2c-.2.3-.6.3-.8.6-.1.3.1.4.1.4s.4.2.6-.3V15z" />
              </svg>
            </Link>
          </div>
          <nav
            role="menu"
            className="items-justified flex justify-center space-x-2 py-0.5"
          >
            <h2 className="sr-only">Main navigation</h2>
            <Popover className="relative">
              {({ open }) => (
                <>
                  <Popover.Button
                    className={cx(
                      open ? 'text-blue-500 dark:text-sky-500' : '',
                      'text group inline-flex items-center px-3 py-2 font-medium leading-tight dark:text-slate-200'
                    )}
                  >
                    <span className="transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500">
                      Features
                    </span>
                    <ChevronDownIcon
                      className={cx(
                        open
                          ? 'text-blue-500 dark:text-sky-500 rotate-180 transform'
                          : '',
                        'ml-2 h-3.5 w-3.5 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500'
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
                    <Popover.Panel className="absolute z-10 mt-3 w-max max-w-3xl xl:max-w-3xl">
                      <div className="overflow-hidden grid grid-gap-4 grid-cols-2 rounded-lg bg-white shadow-lg ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/[0.15]">
                        <div className="relative pt-6 p-4">
                          {flyOutMenuFeaturesOSS.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              className="-m-3 flex items-center py-4 rounded-lg px-2 transition duration-150 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              {item.icon ? (
                                <div className="flex justify-center ml-4">
                                  {item.icon}
                                </div>
                              ) : null}
                              <div className="ml-4">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div className="relative pt-6 p-4">
                          {flyOutMenuFeaturesCI.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              className="-m-3 flex items-center rounded-lg py-4 px-2 transition text-base font-medium duration-150 ease-in-out text-slate-900 hover:bg-slate-50 hover:text-sky-600 dark:hover:bg-slate-800/60 dark:text-slate-200 dark:hover:text-sky-600"
                            >
                              {item.icon ? (
                                <div className="flex justify-center ml-4">
                                  {item.icon}
                                </div>
                              ) : null}
                              <div className="ml-4">
                                <p>{item.name}</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
            <Popover className="relative">
              {({ open }) => (
                <>
                  <Popover.Button
                    className={cx(
                      open ? 'text-blue-500 dark:text-sky-500' : '',
                      'text group inline-flex items-center px-3 py-2 font-medium leading-tight dark:text-slate-200'
                    )}
                  >
                    <span className="transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500">
                      Solutions
                    </span>
                    <ChevronDownIcon
                      className={cx(
                        open
                          ? 'text-blue-500 dark:text-sky-500 rotate-180 transform'
                          : '',
                        'ml-2 h-4 w-4 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500'
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
                    <Popover.Panel className="absolute z-10 mt-3 w-max max-w-3xl">
                      <div className="overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/[0.15]">
                        <h5 className="text-sm px-6 pt-4 text-slate-700 dark:text-slate-400">
                          Scale{' '}
                        </h5>
                        <div className="relative grid gap-6 px-6 pt-6 pb-6 xl:grid-cols-2">
                          {flyOutMenuSolutions.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              target={
                                item.href.startsWith('http')
                                  ? '_blank'
                                  : undefined
                              }
                              className="-m-3 flex items-start rounded-lg p-2 transition duration-150 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <div className="ml-4">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div className="border-t border-slate-100/[0.50] border-solid dark:border-slate-700/[0.50]" />

                        <h5 className="text-sm px-6 pt-4 text-slate-700 dark:text-slate-400">
                          Use Case{' '}
                        </h5>
                        <div className="relative grid gap-6 px-6 pt-6 pb-6 xl:grid-cols-2">
                          {flyOutMenuSolutionsUseCases.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              target={
                                item.href.startsWith('http')
                                  ? '_blank'
                                  : undefined
                              }
                              className="-m-3 flex items-start rounded-lg p-2 transition duration-150 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <div className="ml-4">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>

            <Popover className="relative">
              {({ open }) => (
                <>
                  <Popover.Button
                    className={cx(
                      open ? 'text-blue-500 dark:text-sky-500' : '',
                      'text group inline-flex items-center px-3 py-2 font-medium leading-tight dark:text-slate-200'
                    )}
                  >
                    <span className="transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500">
                      Resources
                    </span>
                    <ChevronDownIcon
                      className={cx(
                        open
                          ? 'text-blue-500 dark:text-sky-500 rotate-180 transform'
                          : '',
                        'ml-2 h-4 w-4 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500'
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
                    <Popover.Panel className="absolute left-60 z-10 mt-3 w-max max-w-md -translate-x-1/2 transform xl:max-w-3xl">
                      <div className="overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/[0.15]">
                        <h5 className="text-sm px-6 pt-4 text-slate-700 dark:text-slate-400">
                          Events{' '}
                        </h5>
                        <div className="relative grid gap-6 px-6 pt-6 pb-6 xl:grid-cols-2">
                          {flyOutMenuResources.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              target={
                                item.href.startsWith('http')
                                  ? '_blank'
                                  : undefined
                              }
                              className="-m-3 flex items-start rounded-lg p-2 transition duration-150 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <div className="ml-4">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                        <div className="border-t border-slate-100/[0.50] border-solid dark:border-slate-700/[0.50]" />

                        <h5 className="text-sm px-6 pt-4 text-slate-700 dark:text-slate-400">
                          Company{' '}
                        </h5>
                        <div className="relative grid gap-6 px-6 pt-6 pb-6 xl:grid-cols-2">
                          {flyOutMenuResourcesAboutUs.map((item) => (
                            <Link
                              key={item.name}
                              href={item.href}
                              target={
                                item.href.startsWith('http')
                                  ? '_blank'
                                  : undefined
                              }
                              className="-m-3 flex items-start rounded-lg p-2 transition duration-150 ease-in-out hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <div className="ml-4">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                  {item.name}
                                </p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>

            <Link
              href="/getting-started/intro"
              title="Documentation"
              className="hidden px-3 py-2 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500 md:inline-flex"
            >
              Documentation
            </Link>
            {/* <Link
              href="/blog"
              title="Blog"
              className="hidden px-3 py-2 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500 md:inline-flex"
            >
              Blog
            </Link> */}
            <a
              href="https://nx.app/pricing"
              title="CI Pricing"
              target="_blank"
              className="hidden px-3 py-2 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500 md:inline-flex"
            >
              CI Pricing{' '}
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 inline-block ml-1" />
            </a>
          </nav>
        </div>
        <div className="flex-shrink-0 text-sm">
          <nav className="items-justified flex justify-center space-x-1">
            <AlgoliaSearch tiny={true} />
            <Link
              className="hidden px-3 py-2 font-medium leading-tight hover:text-blue-500 cursor-pointer dark:text-slate-200 dark:hover:text-sky-500 md:inline-flex"
              title="Contact Us"
              href="/contact"
            >
              {' '}
              Contact{' '}
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 inline-block ml-1" />
            </Link>
            <ButtonLink
              href="https://cloud.nx.app"
              variant="secondary"
              size="small"
              target="_blank"
              title="Log in to your Nx Cloud Account"
            >
              Go to App
            </ButtonLink>
            <a
              title="Nx is open source, check the code on GitHub"
              href="https://github.com/nrwl/nx"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 opacity-60 hover:opacity-90"
            >
              <span className="sr-only">Nx on GitHub</span>
              <div className="item-center flex">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8a8 8 0 0 0-8-8z" />
                </svg>
              </div>
            </a>
          </nav>
        </div>
      </div>
      {/*MOBILE*/}
      <div className="relative mx-auto flex w-full items-center justify-between p-4 lg:hidden">
        <div className="flex flex-shrink-0">
          {/*LOGO*/}
          <Link
            href="/"
            className="flex items-center text-slate-900 dark:text-white"
          >
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="currentColor"
            >
              <title>Nx</title>
              <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
            </svg>
          </Link>
          {/*MENU*/}
          <div className="ml-4 flex flex-shrink-0 items-center">
            <button onClick={() => setIsOpen(!isOpen)}>
              {!isOpen ? (
                <Bars4Icon
                  strokeWidth="2"
                  title="Open navigation menu"
                  className="ml-2 mr-2 h-6 w-6"
                  aria-hidden="true"
                />
              ) : (
                <XMarkIcon
                  strokeWidth="2"
                  title="Close navigation menu"
                  className="ml-2 mr-2 h-7 w-7"
                  aria-hidden="true"
                />
              )}
            </button>
            <Transition show={isOpen} as={Fragment}>
              <Dialog
                open={isOpen}
                onClose={() => {}}
                className="relative z-50 lg:hidden"
              >
                <div className="fixed inset-0 flex w-screen mt-32 bg-white dark:bg-slate-900">
                  <Dialog.Panel className="w-full">
                    <Transition.Child
                      as={Fragment}
                      enter="transition-opacity duration-300"
                      enterFrom="opacity-0"
                      enterTo="opacity-100"
                      leave="transition-opacity duration-300"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Dialog.Description as="div">
                        <Menu
                          as="div"
                          className="border-b border-slate-100/[0.50] pt-8 mx-4 dark:border-slate-700/[0.50]"
                        >
                          {() => (
                            <div>
                              <Menu.Button
                                as="h3"
                                className={cx(
                                  'pb-4 w-full flex relative text-slate-900 hover:text-blue-500 cursor-pointer dark:text-slate-200 dark:hover:text-sky-500'
                                )}
                              >
                                {' '}
                                Features{' '}
                                <ChevronDownIcon
                                  className={cx(
                                    'absolute right-0 -top-0 h-4 w-4 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500'
                                  )}
                                />
                              </Menu.Button>
                              <Menu.Items>
                                {[
                                  ...flyOutMenuFeaturesCI,
                                  ...flyOutMenuFeaturesOSS,
                                ].map((item) => (
                                  <Menu.Item key={item.name}>
                                    {({ active }) => (
                                      <Link
                                        href={item.href}
                                        className={cx(
                                          active
                                            ? 'bg-slate-50 dark:bg-slate-800/60'
                                            : '',
                                          'block py-3 flex items-center text-base text-slate-500 last:pb-6 dark:text-slate-400'
                                        )}
                                      >
                                        <span className="pr-3">
                                          {item.icon}
                                        </span>
                                        {item.name}
                                      </Link>
                                    )}
                                  </Menu.Item>
                                ))}
                              </Menu.Items>
                            </div>
                          )}
                        </Menu>
                        <Menu
                          as="div"
                          className="border-b border-slate-100/[0.50] pt-4 mx-4 dark:border-slate-700/[0.50]"
                        >
                          {() => (
                            <div>
                              <Menu.Button
                                as="h3"
                                className={cx(
                                  'pb-4 w-full flex relative text-slate-900 hover:text-blue-500 cursor-pointer dark:text-slate-200 dark:hover:text-sky-500'
                                )}
                              >
                                {' '}
                                Solutions{' '}
                                <ChevronDownIcon className="absolute right-0 -top-0 h-4 w-4 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500" />
                              </Menu.Button>
                              <Menu.Items>
                                {[
                                  ...flyOutMenuSolutions,
                                  ...flyOutMenuSolutionsUseCases,
                                ].map((item) => (
                                  <Menu.Item key={item.name}>
                                    {({ active }) => (
                                      <Link
                                        href={item.href}
                                        className={cx(
                                          active
                                            ? 'bg-slate-50 dark:bg-slate-800/60'
                                            : '',
                                          'block py-3 flex items-center text-base text-slate-500 last:pb-6 dark:text-slate-400'
                                        )}
                                      >
                                        {item.name}
                                      </Link>
                                    )}
                                  </Menu.Item>
                                ))}
                              </Menu.Items>
                            </div>
                          )}
                        </Menu>
                        <Menu
                          as="div"
                          className="border-b border-slate-100/[0.50] pt-4 mx-4 dark:border-slate-700/[0.50]"
                        >
                          {() => (
                            <div>
                              <Menu.Button
                                as="h3"
                                className="pb-4 w-full flex text-slate-900 dark:text-slate-200 relative cursor-pointer text-base hover:text-blue-500 dark:hover:text-sky-500"
                              >
                                {' '}
                                Resources{' '}
                                <ChevronDownIcon className="absolute right-0 -top-0 h-4 w-4 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500" />
                              </Menu.Button>
                              <Menu.Items>
                                {[
                                  ...flyOutMenuResources,
                                  ...flyOutMenuResourcesAboutUs,
                                ].map((item) => (
                                  <Menu.Item key={item.name}>
                                    {({ active }) => (
                                      <Link
                                        href={item.href}
                                        className={cx(
                                          active
                                            ? 'bg-slate-50 dark:bg-slate-800/60'
                                            : '',
                                          'block py-3 flex items-center text-base text-slate-500 last:pb-6 dark:text-slate-400'
                                        )}
                                      >
                                        {item.name}
                                      </Link>
                                    )}
                                  </Menu.Item>
                                ))}
                              </Menu.Items>
                            </div>
                          )}
                        </Menu>
                        {flyoutMobileMenu.map((item) => (
                          <div
                            key={item.name}
                            className="border-b pt-4 mx-4 text-slate-900 border-slate-100/[0.50] dark:text-slate-200 hover:text-blue-500 dark:hover:text-sky-500 dark:border-slate-700/[0.50]"
                          >
                            <Link
                              key={item.name}
                              href={item.href}
                              target={
                                item.href.startsWith('http')
                                  ? '_blank'
                                  : undefined
                              }
                              className="flex items-start rounded-lg pb-4 transition duration-150 ease-in-out"
                            >
                              <div className="">
                                <p className="text-base hover:text-blue-500 dark:hover:text-sky-500">
                                  {item.name}
                                </p>
                              </div>
                            </Link>
                          </div>
                        ))}
                      </Dialog.Description>
                    </Transition.Child>
                  </Dialog.Panel>
                </div>
              </Dialog>
            </Transition>
          </div>
        </div>
        <div className="items-justified flex flex-shrink-0 justify-center space-x-1 text-sm">
          <Link
            className="inline-flex px-3 py-2 font-medium leading-tight hover:text-blue-500 cursor-pointer dark:text-slate-200 dark:hover:text-sky-500"
            title="Contact Us"
            href="/contact"
          >
            {' '}
            Contact{' '}
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 inline-block ml-1" />
          </Link>
          <ButtonLink
            href="https://cloud.nx.app"
            variant="secondary"
            size="small"
            target="_blank"
            title="Log in to your Nx Cloud Account"
          >
            Go to App
          </ButtonLink>
          <a
            title="Nx is open source, check the code on GitHub"
            href="https://github.com/nrwl/nx"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 opacity-60 hover:opacity-90"
          >
            <span className="sr-only">Nx on GitHub</span>
            <div className="item-center flex">
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
