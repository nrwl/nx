import { memo } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';

export interface SearchDepthProps {
  searchDepth: number;
  searchDepthEnabled: boolean;
  searchDepthFilterEnabledChange: (checked: boolean) => void;
  decrementDepthFilter: () => void;
  incrementDepthFilter: () => void;
}

export const SearchDepth = memo(
  ({
    searchDepth,
    searchDepthEnabled,
    searchDepthFilterEnabledChange,
    decrementDepthFilter,
    incrementDepthFilter,
  }: SearchDepthProps) => {
    return (
      <div className="mt-4 px-4">
        <div className="mt-4 flex items-start">
          <div className="flex h-5 items-center">
            <input
              id="depthFilter"
              name="depthFilter"
              value="depthFilterActivated"
              type="checkbox"
              className="h-4 w-4 accent-blue-500 dark:accent-sky-500"
              checked={searchDepthEnabled}
              onChange={(event) =>
                searchDepthFilterEnabledChange(event.target.checked)
              }
            />
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="depthFilter"
              className="cursor-pointer font-medium text-slate-600 dark:text-slate-400"
            >
              Activate proximity
            </label>
            <p className="text-slate-400 dark:text-slate-500">
              Explore connected libraries step by step.
            </p>
          </div>
        </div>
        <div className="mt-3 px-10">
          <div className="flex rounded-md shadow-sm">
            <button
              data-cy="decrement-depth-filter"
              title="Remove ancestor level"
              className="inline-flex items-center rounded-l-md border border-slate-300 bg-slate-50 py-2 px-4 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
              onClick={decrementDepthFilter}
            >
              <MinusIcon className="h-4 w-4"></MinusIcon>
            </button>
            <span
              id="depthFilterValue"
              data-cy="depth-value"
              className="block w-full flex-1 rounded-none border-t border-b border-slate-300 bg-white p-1.5 text-center font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            >
              {searchDepth}
            </span>
            <button
              data-cy="increment-depth-filter"
              title="Add ancestor level"
              className="inline-flex items-center rounded-r-md border border-slate-300 bg-slate-50 py-2 px-4 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
              onClick={incrementDepthFilter}
            >
              <PlusIcon className="h-4 w-4"></PlusIcon>
            </button>
          </div>
        </div>
      </div>
    );
  }
);
