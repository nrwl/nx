import { memo } from 'react';
import { BoltIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export interface ShowHideAllProps {
  showAll: () => void;
  hideAll: () => void;
  showAffected: () => void;
  hasAffected: boolean;
  label: string;
  isShowingAll?: boolean;
}

export const ShowHideAll = memo(
  ({
    showAll,
    hideAll,
    showAffected,
    hasAffected,
    label,
    isShowingAll = false,
  }: ShowHideAllProps): JSX.Element => {
    return (
      <div className="mt-8 px-4">
        <button
          onClick={showAll}
          type="button"
          className={`flex w-full items-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm ${
            isShowingAll
              ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-900/50 dark:text-blue-300 hover:dark:bg-blue-900/70'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700'
          }`}
          data-cy="selectAllButton"
        >
          <EyeIcon
            className={`-ml-1 mr-2 h-5 w-5 ${
              isShowingAll
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-slate-400'
            }`}
          ></EyeIcon>
          {isShowingAll ? 'Showing all' : 'Show all'} {label}
        </button>

        {hasAffected ? (
          <button
            onClick={showAffected}
            type="button"
            className="mt-3 flex w-full items-center rounded-md border border-pink-500 bg-pink-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pink-500 dark:border-fuchsia-800 dark:bg-fuchsia-700 dark:text-white hover:dark:bg-fuchsia-600"
            data-cy="affectedButton"
          >
            <BoltIcon className="-ml-1 mr-2 h-5 w-5 text-white"></BoltIcon>
            Show affected {label}
          </button>
        ) : null}

        <button
          onClick={hideAll}
          type="button"
          className="mt-3 flex w-full items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
          data-cy="deselectAllButton"
        >
          <EyeSlashIcon className="-ml-1 mr-2 h-5 w-5 text-slate-500"></EyeSlashIcon>
          Hide all {label}
        </button>
      </div>
    );
  }
);
