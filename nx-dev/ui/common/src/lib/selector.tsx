import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';

export interface SelectorProps<T> {
  items: { label: string; value: string; data?: T }[];
  selected: { label: string; value: string };
  onChange: (item: { label: string; value: string; data?: T }) => void;
}

export function Selector<T = {}>(props: SelectorProps<T>) {
  return (
    <div className="w-full">
      <Listbox
        value={props.selected}
        onChange={(selection) => props.onChange(selection)}
      >
        {({ open }) => (
          <>
            <div className="relative mt-1">
              <Listbox.Button className="relative w-full py-2 pl-3 pr-10 text-left bg-white rounded border border-gray-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-opacity-75 focus-visible:ring-white focus-visible:ring-offset-blue-300 focus-visible:ring-offset-2 focus-visible:border-blue-500 sm:text-sm font-medium">
                <span className="block truncate">{props.selected.label}</span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <SelectorIcon
                    className="w-5 h-5 text-gray-500"
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
                  className="absolute w-full py-1 mt-1 overflow-auto text-base bg-white rounded-sm shadow-md max-h-60 focus:outline-none sm:text-sm z-10"
                >
                  {props.items.map((item, personIdx) => (
                    <Listbox.Option
                      key={personIdx}
                      className={({ active }) =>
                        `${
                          active
                            ? 'text-white bg-blue-nx-base'
                            : 'text-gray-500'
                        }
                          cursor-pointer select-none relative py-2 pl-10 pr-4`
                      }
                      value={item}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={'font-medium block truncate'}>
                            {item.label}
                          </span>
                          {selected || item.value === props.selected.value ? (
                            <span
                              className={`${
                                active ? 'text-white' : 'text-gray-500'
                              }
                                absolute inset-y-0 left-0 flex items-center pl-3`}
                            >
                              <CheckIcon
                                className="w-5 h-5"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
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

export default Selector;
