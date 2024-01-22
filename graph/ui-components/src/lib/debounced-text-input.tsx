import { KeyboardEvent, useEffect, useState } from 'react';
import { useDebounce } from './use-debounce';
import { BackspaceIcon, FunnelIcon } from '@heroicons/react/24/outline';

export interface DebouncedTextInputProps {
  initialText: string;
  placeholderText: string;
  resetTextFilter: () => void;
  updateTextFilter: (textFilter: string) => void;
}

export function DebouncedTextInput({
  initialText,
  placeholderText,
  resetTextFilter,
  updateTextFilter,
}: DebouncedTextInputProps) {
  const [currentTextFilter, setCurrentTextFilter] = useState(initialText ?? '');

  const [debouncedValue, setDebouncedValue] = useDebounce(
    currentTextFilter,
    500
  );

  function onTextFilterKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      onTextInputChange(event.currentTarget.value);
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
    if (debouncedValue !== '') {
      updateTextFilter(debouncedValue);
    }
  }, [debouncedValue, updateTextFilter]);

  return (
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
        placeholder={placeholderText}
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
  );
}
