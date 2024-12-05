'use client';
import { Dialog, Disclosure, Popover, Transition } from '@headlessui/react';
import {
  Bars4Icon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import cx from 'classnames';
import Link from 'next/link';
import { Fragment, ReactElement, useEffect, useState } from 'react';
import { ButtonLink, ButtonLinkProps } from '../button';
import { resourceMenuItems } from './menu-items';
import { MobileMenuItem } from './mobile-menu-item';
import { SectionsMenu } from './sections-menu';
import { AlgoliaSearch } from '@nx/nx-dev/feature-search';
import { GitHubIcon, NxIcon } from '@nx/nx-dev/ui-icons';

interface HeaderProps {
  ctaButtons?: ButtonLinkProps[];
}

export function Header({ ctaButtons }: HeaderProps): ReactElement {
  let [isOpen, setIsOpen] = useState(false);

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

  const defaultCtaButtons: ButtonLinkProps[] = [
    {
      href: '/nx-cloud',
      variant: 'primary',
      size: 'small',
      target: '_blank',
      title: 'Try Nx Cloud for free',
      children: <span>Try Nx Cloud for free</span>,
    },
  ];

  const buttonsToRender = ctaButtons || defaultCtaButtons;

  return (
    <div className="fixed inset-x-0 top-0 isolate z-[5] flex px-4 print:hidden">
      <div
        className="absolute inset-x-0 top-0 mx-auto h-20 max-w-7xl backdrop-blur"
        style={{
          maskImage:
            'linear-gradient(to bottom, #000000 20%, transparent calc(100% - 20%))',
        }}
      />
      {/*DESKTOP*/}
      <div className="mx-auto mt-2 hidden w-full max-w-7xl items-center justify-between space-x-10 rounded-xl border border-slate-200/40 bg-white/70 px-4 py-2 shadow-sm backdrop-blur-xl backdrop-saturate-150 lg:flex dark:border-slate-800/60 dark:bg-slate-950/40">
        {/*PRIMARY NAVIGATION*/}
        <div className="flex flex-shrink-0 text-sm">
          {/*LOGO*/}
          <Link
            href="/"
            className="mr-4 flex items-center text-slate-900 dark:text-white"
            prefetch={false}
          >
            <span className="sr-only">Nx</span>
            <NxIcon aria-hidden="true" className="h-8 w-8" />
          </Link>
          <nav
            role="menu"
            className="items-justified flex items-center justify-center space-x-2 py-0.5"
          >
            <h2 className="sr-only">Main navigation</h2>
            <Link
              href="/getting-started/intro"
              title="Documentation"
              className="hidden px-3 py-2 font-medium leading-tight hover:text-blue-500 md:inline-flex dark:text-slate-200 dark:hover:text-sky-500"
              prefetch={false}
            >
              Docs
            </Link>
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
            <div className="hidden h-6 w-px bg-slate-200 md:block dark:bg-slate-700" />
            <div className="px-3 opacity-50 hover:opacity-100">
              <AlgoliaSearch tiny={true} />
            </div>
          </nav>
        </div>
        {/*SECONDARY NAVIGATION*/}
        <div className="flex-shrink-0 text-sm">
          <nav className="flex items-center justify-center space-x-1">
            {buttonsToRender.map((buttonProps, index) => (
              <ButtonLink key={index} {...buttonProps} />
            ))}
            <a
              title="Nx is open source, check the code on GitHub"
              href="https://github.com/nrwl/nx"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 py-2 opacity-60 hover:opacity-90"
            >
              <span className="sr-only">Nx on GitHub</span>
              <GitHubIcon aria-hidden="true" className="h-5 w-5" />
            </a>
          </nav>
        </div>
      </div>
      {/*MOBILE*/}
      <div className="relative mx-auto flex w-full items-center justify-between p-4 lg:hidden">
        <div className="flex w-full items-center justify-between">
          {/*LOGO*/}
          <Link
            href="/"
            className="flex items-center text-slate-900 dark:text-white"
            prefetch={false}
          >
            <span className="sr-only">Nx</span>
            <NxIcon aria-hidden="true" className="h-8 w-8" />
          </Link>
          <div className="flex items-center gap-6">
            <a
              title="Nx is open source, check the code on GitHub"
              href="https://github.com/nrwl/nx"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 py-2 opacity-60 hover:opacity-90"
            >
              <span className="sr-only">Nx on GitHub</span>
              <GitHubIcon aria-hidden="true" className="h-5 w-5" />
            </a>
            {/*MENU*/}
            <button onClick={() => setIsOpen(!isOpen)} className="shrink-0 p-2">
              <Bars4Icon
                aria-hidden="true"
                title="Open navigation menu"
                strokeWidth="2"
                className="h-6 w-6"
              />
              <span className="sr-only">Open navigation panel</span>
            </button>
          </div>
        </div>
      </div>
      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsOpen(!isOpen)}
        >
          <div className="fixed inset-0" />
          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-250 sm:duration-500"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-250 sm:duration-500"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen">
                    <div className="flex h-full flex-col overflow-y-scroll bg-white py-6 shadow-xl dark:bg-slate-900">
                      <div className="px-4 sm:px-6">
                        <div className="flex items-start justify-between">
                          <Dialog.Title>
                            <Link
                              href="/"
                              className="flex items-center text-slate-900 dark:text-white"
                              prefetch={false}
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
                              <span className="sr-only">Nx</span>
                            </Link>
                          </Dialog.Title>
                          <div className="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              className="dark:hovers:text-sky-500 relative rounded-md text-slate-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-400 dark:focus:ring-sky-500"
                              onClick={() => setIsOpen(!isOpen)}
                            >
                              <span className="absolute -inset-2.5" />
                              <span className="sr-only">
                                Close navigation panel
                              </span>
                              <XMarkIcon
                                aria-hidden="true"
                                className="h-6 w-6"
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="relative mt-6 flex-1 px-4 sm:px-6">
                        <ButtonLink
                          href="/nx-cloud"
                          variant="primary"
                          size="small"
                          target="_blank"
                          title="Try Nx Cloud for free"
                          className="w-full"
                        >
                          Try Nx Cloud for free
                        </ButtonLink>

                        <div className="mt-4 divide-y divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                          <Link
                            href="/getting-started/intro"
                            title="Documentation"
                            className="block py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Docs
                          </Link>
                          <Link
                            href="/blog"
                            title="Blog"
                            className="block py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Blog
                          </Link>
                          {/*Resources*/}
                          <Disclosure as="div">
                            {({ open }) => (
                              <>
                                <Disclosure.Button
                                  className={cx(
                                    open
                                      ? 'text-blue-500 dark:text-sky-500'
                                      : 'tex-slate-800 dark:text-slate-200',
                                    'flex w-full items-center justify-between py-4 text-left text-base font-medium focus:outline-none'
                                  )}
                                >
                                  <span>Resources</span>
                                  <ChevronDownIcon
                                    aria-hidden="true"
                                    className={cx(
                                      open
                                        ? 'rotate-180 transform text-blue-500 dark:text-sky-500'
                                        : 'tex-slate-800 dark:text-slate-200',
                                      'h-3 w-3 transition duration-150 ease-in-out group-hover:text-blue-500 dark:group-hover:text-sky-500'
                                    )}
                                  />
                                </Disclosure.Button>
                                <Disclosure.Panel
                                  as="ul"
                                  className="space-y-1 pb-2"
                                >
                                  {Object.values(resourceMenuItems)
                                    .flat()
                                    .map((item) => (
                                      <MobileMenuItem
                                        key={item.name}
                                        item={item}
                                      />
                                    ))}
                                </Disclosure.Panel>
                              </>
                            )}
                          </Disclosure>
                          <Link
                            href="/nx-cloud"
                            title="Nx Cloud"
                            className="flex w-full gap-2 py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Nx Cloud
                          </Link>
                          <Link
                            href="/pricing"
                            title="Pricing"
                            className="flex w-full gap-2 py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Pricing
                          </Link>
                          <Link
                            href="/powerpack"
                            title="Powerpack"
                            className="flex w-full gap-2 py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Powerpack
                          </Link>
                          <Link
                            href="/enterprise"
                            title="Enterprise"
                            className="flex w-full gap-2 py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Enterprise
                          </Link>
                          <Link
                            href="/contact"
                            title="Contact"
                            className="block py-4 font-medium leading-tight hover:text-blue-500 dark:text-slate-200 dark:hover:text-sky-500"
                            prefetch={false}
                          >
                            Contact
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
}
