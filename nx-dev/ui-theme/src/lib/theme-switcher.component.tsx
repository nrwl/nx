import { Listbox, Transition } from '@headlessui/react';
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import cx from 'classnames';
import { Fragment } from 'react';
import { useTheme } from './theme.provider';

export function ThemeSwitcher() {
  const [theme, setTheme] = useTheme();
  const themeMap = {
    dark: {
      className: 'group-hover:text-white',
      icon: <MoonIcon className="h-4 w-4" />,
    },
    light: {
      className: 'group-hover:text-yellow-500',
      icon: <SunIcon className="h-4 w-4" />,
    },
    system: {
      className: 'group-hover:text-blue-500',
      icon: <ComputerDesktopIcon className="h-4 w-4" />,
    },
  };
  const availableThemes = [
    {
      label: 'Light',
      value: 'light',
      icon: <SunIcon className="mr-4 h-4 w-4" />,
    },
    {
      label: 'Dark',
      value: 'dark',
      icon: <MoonIcon className="mr-4 h-4 w-4" />,
    },
    {
      label: 'System',
      value: 'system',
      icon: <ComputerDesktopIcon className="mr-4 h-4 w-4" />,
    },
  ];

  return (
    <div className="inline-block">
      <div className="group relative flex h-full w-full items-center px-1">
        <Listbox value={theme} onChange={setTheme}>
          <Listbox.Label className="sr-only">Theme</Listbox.Label>
          <Listbox.Button
            type="button"
            className={cx(
              'inline-flex p-2 text-sm font-medium opacity-60 transition-opacity group-hover:opacity-100',
              themeMap[theme].className
            )}
          >
            {themeMap[theme].icon}
          </Listbox.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Listbox.Options className="absolute top-full right-0 z-50  mt-2 w-36 origin-top-right divide-y divide-slate-100 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none dark:divide-slate-800 dark:bg-slate-900 dark:ring-white/5">
              {availableThemes.map(({ value, label, icon }) => (
                <Listbox.Option key={value} value={value} as={Fragment}>
                  {({ active, selected }) => (
                    <li
                      className={cx(
                        'flex cursor-pointer items-center px-4 py-2 text-sm',
                        {
                          'bg-slate-100 dark:bg-slate-800/60': active,
                          'text-blue-500 dark:text-sky-500': active || selected,
                          'text-slate-700 dark:text-slate-400': !active,
                        }
                      )}
                    >
                      {icon}
                      {label}
                    </li>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </Listbox>
      </div>
    </div>
  );
}
