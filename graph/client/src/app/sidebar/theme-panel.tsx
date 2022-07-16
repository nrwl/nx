import { Menu, Transition } from '@headlessui/react';
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/solid';
import classNames from 'classnames';
import { Fragment, useEffect, useState } from 'react';
import { localStorageThemeKey, Theme, themeResolver } from '../theme-resolver';

export default function ThemePanel() {
  const [theme, setTheme] = useState(
    (localStorage.getItem(localStorageThemeKey) as Theme) || 'system'
  );

  useEffect(() => {
    themeResolver(theme);
  }, [theme]);

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button
          className="dark:text-green-nx-base inline-flex w-full justify-center rounded-md p-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
          data-cy="theme-open-modal-button"
        >
          <span className="sr-only">Theme switcher</span>
          {theme === 'system' && (
            <ComputerDesktopIcon className="h-5 w-5" aria-hidden="true" />
          )}
          {theme === 'light' && (
            <SunIcon className="h-5 w-5" aria-hidden="true" />
          )}
          {theme === 'dark' && (
            <MoonIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </Menu.Button>
      </div>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-50 mt-2 w-36 origin-top-right rounded-md bg-white text-slate-500 shadow-lg ring-1 ring-slate-900/10 ring-opacity-5 focus:outline-none dark:bg-slate-800 dark:text-slate-400 dark:ring-0">
          <div className="px-1 py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  data-cy="system-theme-button"
                  className={classNames(
                    theme === 'system' ? 'text-green-nx-base' : '',
                    active ? 'bg-slate-50 dark:bg-slate-600/30' : '',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm'
                  )}
                  onClick={() => setTheme('system')}
                >
                  <ComputerDesktopIcon
                    className="mr-2 h-5 w-5"
                    aria-hidden="true"
                  />
                  System
                </button>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  data-cy="light-theme-button"
                  className={classNames(
                    theme === 'light' ? 'text-green-nx-base' : '',
                    active ? 'bg-slate-50 dark:bg-slate-600/30' : '',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm'
                  )}
                  onClick={() => setTheme('light')}
                >
                  <SunIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                  Light
                </button>
              )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <button
                  data-cy="dark-theme-button"
                  className={classNames(
                    theme === 'dark' ? 'text-green-nx-base' : '',
                    active ? 'bg-slate-50 dark:bg-slate-600/30' : '',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm'
                  )}
                  onClick={() => setTheme('dark')}
                >
                  <MoonIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                  Dark
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
