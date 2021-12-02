import { useEffect, useState } from 'react';
import { useDebounce } from '../hooks/use-debounce';

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

  const debouncedTextFilter = useDebounce(currentTextFilter, 500);

  function onTextFilterKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      updateTextFilter(event.currentTarget.value);
    }
  }

  function onTextInputChange(change: string) {
    if (change === '') {
      setCurrentTextFilter('');
      resetTextFilter();
    } else {
      setCurrentTextFilter(change);
    }
  }

  function resetClicked() {
    setCurrentTextFilter('');
    resetTextFilter();
  }

  useEffect(() => {
    if (debouncedTextFilter !== '') {
      updateTextFilter(debouncedTextFilter);
    }
  }, [debouncedTextFilter, updateTextFilter]);

  return (
    <div>
      <div className="mt-10 px-4">
        <form
          className="flex rounded-md shadow-sm relative"
          onSubmit={(event) => event.preventDefault()}
        >
          <span className="inline-flex items-center p-2 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </span>
          <input
            type="text"
            className="p-1.5 bg-white text-gray-600 flex-1 block w-full rounded-none rounded-r-md border border-gray-300"
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
              className="p-1 top-1 right-1 absolute bg-white inline-block rounded-md text-gray-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
                />
              </svg>
            </button>
          ) : null}
        </form>
      </div>

      <div className="mt-4 px-4">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              disabled={textFilter.length === 0}
              id="includeInPath"
              name="textFilterCheckbox"
              type="checkbox"
              value="includeInPath"
              className="h-4 w-4 border-gray-300 rounded"
              checked={includePath}
              onChange={toggleIncludeLibsInPathChange}
            ></input>
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="includeInPath"
              className="font-medium text-gray-700 cursor-pointer"
            >
              Include related libraries
            </label>
            <p className="text-gray-500">
              Show libraries that are related to your search.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TextFilterPanel;
