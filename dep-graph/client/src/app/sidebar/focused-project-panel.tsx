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
          className="p-2 shadow-sm bg-green-nx-base text-gray-50 border border-gray-200 rounded-md flex items-center group relative cursor-pointer overflow-hidden"
          data-cy="unfocusButton"
          onClick={() => resetFocus()}
        >
          <p className="truncate transition duration-200 ease-in-out group-hover:opacity-60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 inline -mt-1 mr-1"
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
          <div className="absolute right-2 flex transition-all translate-x-32 transition duration-200 ease-in-out group-hover:translate-x-0 pl-2 rounded-md text-gray-700 items-center text-sm font-medium bg-white shadow-sm ring-1 ring-gray-500">
            Reset
            <span className="p-1 rounded-md">
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
