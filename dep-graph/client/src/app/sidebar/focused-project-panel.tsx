import { memo } from 'react';

export interface FocusedProjectPanelProps {
  focusedProject: string;
  resetFocus: () => void;
}

export const FocusedProjectPanel = memo(
  ({ focusedProject, resetFocus }: FocusedProjectPanelProps) => {
    return (
      <div className="mt-10 px-4">
        <div
          className="bg-green-nx-base group relative flex cursor-pointer items-center overflow-hidden rounded-md border border-gray-200 p-2 text-gray-50 shadow-sm"
          data-cy="unfocusButton"
          onClick={() => resetFocus()}
        >
          <p className="truncate transition duration-200 ease-in-out group-hover:opacity-60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="-mt-1 mr-1 inline h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span id="focused-project-name">Focused on {focusedProject}</span>
          </p>
          <div className="absolute right-2 flex translate-x-32 items-center rounded-md bg-white pl-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-500 transition-all transition duration-200 ease-in-out group-hover:translate-x-0">
            Reset
            <span className="rounded-md p-1">
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
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    );
  }
);

export default FocusedProjectPanel;
