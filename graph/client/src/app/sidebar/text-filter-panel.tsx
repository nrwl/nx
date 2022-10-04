import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useDebounce } from '../hooks/use-debounce';
import { BackspaceIcon, FunnelIcon } from '@heroicons/react/24/outline';

export interface TextFilterPanelProps {
  textFilter: string;
  resetTextFilter: () => void;
  updateTextFilter: (textFilter: string) => void;
  toggleIncludeLibsInPathChange: () => void;
  includePath: boolean;
}

export function TextFilterPanel({
  textFilter,
  resetTextFilter,
  updateTextFilter,
  toggleIncludeLibsInPathChange,
  includePath,
}: TextFilterPanelProps) {
  const [currentTextFilter, setCurrentTextFilter] = useState('');

  const [debouncedValue, setDebouncedValue] = useDebounce(
    currentTextFilter,
    500
  );

  function onTextFilterKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      updateTextFilter(event.currentTarget.value);
    }
  }

  function onTextInputChange(change: string) {
    if (change === '') {
      setCurrentTextFilter('');
      setDebouncedValue('');

      resetTextFilter();
    } else {
      setCurrentTextFilter(change);
    }
  }

  function resetClicked() {
    setCurrentTextFilter('');
    setDebouncedValue('');

    resetTextFilter();
  }

  useEffect(() => {
    updateTextFilter(debouncedValue);
  }, [debouncedValue, updateTextFilter]);

  return (
    <div>
      <div className="mt-10 px-4">
        <form
          className="group relative flex rounded-md shadow-sm"
          onSubmit={(event) => event.preventDefault()}
        >
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 p-2 dark:border-slate-900 dark:bg-slate-800">
            <FunnelIcon className="h-4 w-4"></FunnelIcon>
          </span>
          <input
            type="text"
            className={`block w-full flex-1 rounded-none rounded-r-md border border-slate-300 bg-white p-1.5 font-light text-slate-400 placeholder:font-light placeholder:text-slate-400 dark:border-slate-900 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700`}
            placeholder="lib name, other lib name"
            data-cy="textFilterInput"
            name="filter"
            value={currentTextFilter}
            onKeyUp={onTextFilterKeyUp}
            onChange={(event) => onTextInputChange(event.currentTarget.value)}
          ></input>
          {currentTextFilter.length > 0 ? (
            <button
              data-cy="textFilterReset"
              type="reset"
              onClick={resetClicked}
              className="absolute top-1 right-1 inline-block rounded-md bg-slate-50 p-1 text-slate-400 dark:bg-slate-800"
            >
              <BackspaceIcon className="h-5 w-5"></BackspaceIcon>
            </button>
          ) : null}
        </form>
      </div>

      <div className="mt-4 px-4">
        <div className="flex items-start">
          <div className="flex h-5 items-center">
            <input
              disabled={textFilter.length === 0}
              id="includeInPath"
              name="textFilterCheckbox"
              type="checkbox"
              value="includeInPath"
              className="h-4 w-4 accent-blue-500 dark:accent-sky-500"
              checked={includePath}
              onChange={toggleIncludeLibsInPathChange}
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="includeInPath"
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              Include related libraries
            </label>
            <p className="text-slate-400 dark:text-slate-500">
              Show libraries that are related to your search.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TextFilterPanel;
