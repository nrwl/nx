import { memo } from 'react';
import { BoltIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export interface ShowHideAllProjectsProps {
  showAllProjects: () => void;
  hideAllProjects: () => void;
  showAffectedProjects: () => void;
  hasAffectedProjects: boolean;
}

export const ShowHideAllProjects = memo(
  ({
    showAllProjects,
    hideAllProjects,
    showAffectedProjects,
    hasAffectedProjects: affectedProjects,
  }: ShowHideAllProjectsProps) => {
    return (
      <div className="mt-8 px-4">
        <button
          onClick={showAllProjects}
          type="button"
          className="flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
          data-cy="selectAllButton"
        >
          <EyeIcon className="-ml-1 mr-2 h-5 w-5 text-slate-400"></EyeIcon>
          Show all projects
        </button>

        {affectedProjects ? (
          <button
            onClick={showAffectedProjects}
            type="button"
            className="mt-3 flex w-full items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-500 shadow-sm hover:bg-red-50 dark:border-red-700 dark:bg-slate-800 hover:dark:bg-slate-700"
            data-cy="affectedButton"
          >
            <BoltIcon className="-ml-1 mr-2 h-5 w-5 text-red-500"></BoltIcon>
            Show affected projects
          </button>
        ) : null}

        <button
          onClick={hideAllProjects}
          type="button"
          className="mt-3 flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
          data-cy="deselectAllButton"
        >
          <EyeSlashIcon className="-ml-1 mr-2 h-5 w-5 text-slate-500"></EyeSlashIcon>
          Hide all projects
        </button>
      </div>
    );
  }
);

export default ShowHideAllProjects;
