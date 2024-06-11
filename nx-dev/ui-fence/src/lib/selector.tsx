import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { Fragment, JSX } from 'react';

export interface SelectorProps<T> {
  children: JSX.Element;
  className?: string;
  items: { label: string; value: string; data?: T }[];
  selected: { label: string; value: string };
  onChange: (item: { label: string; value: string; data?: T }) => void;
}

export function Selector<T = {}>(props: SelectorProps<T>): JSX.Element {
  return (
    <div className="w-full">
      <Listbox
        value={props.selected}
        onChange={(selection) => props.onChange(selection)}
      >
        {({ open }) => (
          <>
            <div className="relative">
              <Listbox.Button
                className={
                  'relative w-full cursor-pointer border border-slate-200 py-2 pl-3 pr-10 text-left font-medium focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300 sm:text-sm dark:border-slate-700' +
                  (props.className ? ` ${props.className}` : '')
                }
              >
                <span className="block truncate">
                  <span className="inline-block align-bottom">
                    {props.children}
                  </span>
                  {props.selected.label}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-slate-500"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
              <Transition
                show={open}
                as={Fragment}
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Listbox.Options
                  static
                  className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm bg-white py-1 pl-0 text-base shadow-md focus:outline-none sm:text-sm dark:bg-slate-800/60 dark:focus-within:ring-sky-500"
                >
                  {props.items.map((item, personIdx) => (
                    <Listbox.Option
                      key={personIdx}
                      className={({ active }) =>
                        `relative cursor-pointer select-none list-none px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800`
                      }
                      value={item}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={'block truncate font-medium'}>
                            {item.label}
                          </span>
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
}
