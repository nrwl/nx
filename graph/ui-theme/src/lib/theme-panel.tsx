import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from '@headlessui/react';
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { Fragment, useEffect, useState } from 'react';
import { localStorageThemeKey, Theme, themeResolver } from './theme-resolver';

export function ThemePanel({
  onThemeChange,
}: {
  onThemeChange?: (theme: Theme) => void;
}): JSX.Element {
  const [theme, setTheme] = useState(
    (localStorage.getItem(localStorageThemeKey) as Theme) || 'system'
  );

  useEffect(() => {
    themeResolver(theme);

    if (onThemeChange) {
      onThemeChange(theme);
    }
  }, [theme]);

  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <MenuButton
          className="inline-flex w-full justify-center rounded-md p-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 dark:text-sky-500"
          data-cy="theme-open-modal-button"
        >
          <span className="sr-only">Theme switcher</span>
          {theme === 'system' && (
            <ComputerDesktopIcon className="h-4 w-4" aria-hidden="true" />
          )}
          {theme === 'light' && (
            <SunIcon className="h-4 w-4" aria-hidden="true" />
          )}
          {theme === 'dark' && (
            <MoonIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </MenuButton>
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
        <MenuItems className="absolute right-0 z-50 mt-2 w-36 origin-top-right rounded-md bg-white text-slate-500 shadow-lg ring-1 ring-slate-900/10 ring-opacity-5 focus:outline-none dark:bg-slate-800 dark:text-slate-400 dark:ring-0">
          <div className="px-1 py-1">
            <MenuItem>
              {({ focus }) => (
                <button
                  data-cy="system-theme-button"
                  className={classNames(
                    theme === 'system' ? 'text-blue-500 dark:text-sky-500' : '',
                    focus ? 'bg-slate-50 dark:bg-slate-600/30' : '',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm'
                  )}
                  onClick={() => setTheme('system')}
                >
                  <ComputerDesktopIcon
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                  />
                  System
                </button>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <button
                  data-cy="light-theme-button"
                  className={classNames(
                    theme === 'light' ? 'text-blue-500 dark:text-sky-500' : '',
                    focus ? 'bg-slate-50 dark:bg-slate-600/30' : '',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm'
                  )}
                  onClick={() => setTheme('light')}
                >
                  <SunIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Light
                </button>
              )}
            </MenuItem>
            <MenuItem>
              {({ focus }) => (
                <button
                  data-cy="dark-theme-button"
                  className={classNames(
                    theme === 'dark' ? 'text-blue-500 dark:text-sky-500' : '',
                    focus ? 'bg-slate-50 dark:bg-slate-600/30' : '',
                    'group flex w-full items-center rounded-md px-2 py-2 text-sm'
                  )}
                  onClick={() => setTheme('dark')}
                >
                  <MoonIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Dark
                </button>
              )}
            </MenuItem>
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  );
}
