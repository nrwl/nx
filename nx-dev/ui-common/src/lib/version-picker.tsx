'use client';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { Fragment, JSX, useState } from 'react';

const versionOptions = [
  {
    label: '20',
    value: '',
  },
  {
    label: '19',
    value: '19',
  },
  {
    label: '18',
    value: '18',
  },
  {
    label: '17',
    value: '17',
  },
];

export function VersionPicker(): JSX.Element {
  const [selected, _] = useState(versionOptions[0]);
  return (
    <>
      <span className="inline-block align-bottom text-sm font-semibold uppercase leading-[38px] tracking-wide text-slate-800 lg:text-xs lg:leading-[38px] dark:text-slate-200"></span>
      <div className="ml-2 inline-block">
        <div className="w-full">
          <Listbox value={selected}>
            {({ open }) => (
              <div className="relative">
                <Listbox.Button
                  className={
                    'relative w-full cursor-pointer rounded-lg border border-slate-200 py-2 pl-3 pr-10 text-left font-medium focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300 sm:text-sm dark:border-slate-700'
                  }
                >
                  <span className="block truncate">{selected.label}</span>
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
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm bg-white py-1 pl-0 text-base shadow-md focus:outline-none sm:text-sm dark:bg-slate-800/90 dark:focus-within:ring-sky-500"
                  >
                    {versionOptions.map((item, idx) => (
                      <Listbox.Option
                        key={idx}
                        className={({ active }) =>
                          `relative cursor-pointer select-none list-none hover:bg-slate-50 dark:hover:bg-slate-800`
                        }
                        value={item}
                      >
                        {() => (
                          <Link
                            href={
                              item.value
                                ? `https://${item.value}.nx.dev/docs`
                                : '#'
                            }
                            className={'block truncate px-3 py-2 font-medium'}
                          >
                            {item.label}
                          </Link>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            )}
          </Listbox>
        </div>
      </div>
    </>
  );
}
