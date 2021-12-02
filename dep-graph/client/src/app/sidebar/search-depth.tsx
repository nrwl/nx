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
          <div className="flex items-center h-5">
            <input
              id="depthFilter"
              name="depthFilter"
              value="depthFilterActivated"
              type="checkbox"
              className="h-4 w-4 border-gray-300 rounded"
              checked={searchDepthEnabled}
              onChange={(event) =>
                searchDepthFilterEnabledChange(event.target.checked)
              }
            ></input>
          </div>
          <div className="ml-3 text-sm">
            <label
              htmlFor="depthFilter"
              className="cursor-pointer font-medium text-gray-700"
            >
              Activate proximity
            </label>
            <p className="text-gray-500">
              Explore connected libraries step by step.
            </p>
          </div>
        </div>
        <div className="mt-3 px-10">
          <div className="flex rounded-md shadow-sm text-gray-500">
            <button
              title="Remove ancestor level"
              className="inline-flex items-center py-2 px-4 rounded-l-md border border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100"
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
              className="p-1.5 bg-white flex-1 block w-full rounded-none border-t border-b border-gray-300 text-center font-mono"
            >
              {searchDepth}
            </span>
            <button
              title="Add ancestor level"
              className="inline-flex items-center py-2 px-4 rounded-r-md border border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100"
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
