import { ArrowRightCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
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
          className="bg-green-nx-base group relative flex cursor-pointer items-center overflow-hidden rounded-md border border-slate-200 p-2 text-slate-50 shadow-sm dark:border-slate-700"
          data-cy="unfocusButton"
          onClick={() => resetFocus()}
        >
          <p className="truncate transition duration-200 ease-in-out group-hover:opacity-60">
            <ArrowRightCircleIcon className="-mt-1 mr-1 inline h-6 w-6" />
            <span id="focused-project-name">Focused on {focusedProject}</span>
          </p>
          <div className="absolute right-2 flex translate-x-32 items-center rounded-md bg-white pl-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-500 transition-all duration-200 ease-in-out group-hover:translate-x-0 dark:bg-slate-800 dark:text-slate-300">
            Reset
            <span className="rounded-md p-1">
              <XCircleIcon className="h-5 w-5" />
            </span>
          </div>
        </div>
      </div>
    );
  }
);

export default FocusedProjectPanel;
