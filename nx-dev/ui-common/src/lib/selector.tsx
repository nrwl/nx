import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';
import { Fragment, ReactComponentElement } from 'react';

export interface SelectorProps<T> {
  items: { label: string; value: string; data?: T }[];
  selected: { label: string; value: string };
  onChange: (item: { label: string; value: string; data?: T }) => void;
}

export function Selector<T = {}>(
  props: SelectorProps<T>
): ReactComponentElement<any> {
  return (
    <div className="w-full">
      <Listbox
        value={props.selected}
        onChange={(selection) => props.onChange(selection)}
      >
        {({ open }) => (
          <>
            <div className="relative mt-1">
              <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-200 bg-white py-2 pl-3 pr-10 text-left font-medium focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300 sm:text-sm">
                <span className="block truncate">{props.selected.label}</span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <SelectorIcon
                    className="h-5 w-5 text-gray-500"
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
                  className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm bg-white py-1 text-base shadow-md focus:outline-none sm:text-sm"
                >
                  {props.items.map((item, personIdx) => (
                    <Listbox.Option
                      key={personIdx}
                      className={({ active }) =>
                        `${
                          active
                            ? 'bg-blue-nx-base text-white'
                            : 'text-gray-500'
                        }
                          relative cursor-pointer select-none py-2 pl-10 pr-4`
                      }
                      value={item}
                    >
                      {({ selected, active }) => (
                        <>
                          <span className={'block truncate font-medium'}>
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
                                className="h-5 w-5"
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
