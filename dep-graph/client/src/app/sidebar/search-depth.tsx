import { memo } from 'react';

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
              className="h-4 w-4 rounded border-slate-300 dark:text-slate-700"
              checked={searchDepthEnabled}
              onChange={(event) =>
                searchDepthFilterEnabledChange(event.target.checked)
              }
            ></input>
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
              title="Remove ancestor level"
              className="inline-flex items-center rounded-l-md border border-slate-300 bg-slate-50 py-2 px-4 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
              onClick={decrementDepthFilter}
            >
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
                  d="M20 12H4"
                />
              </svg>
            </button>
            <span
              id="depthFilterValue"
              className="block w-full flex-1 rounded-none border-t border-b border-slate-300 bg-white p-1.5 text-center font-mono dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            >
              {searchDepth}
            </span>
            <button
              title="Add ancestor level"
              className="inline-flex items-center rounded-r-md border border-slate-300 bg-slate-50 py-2 px-4 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
              onClick={incrementDepthFilter}
            >
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default SearchDepth;
