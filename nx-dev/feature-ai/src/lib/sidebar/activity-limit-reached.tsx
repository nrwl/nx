import { InformationCircleIcon } from '@heroicons/react/24/outline';

export function ActivityLimitReached(): JSX.Element {
  return (
    <div className="rounded-md bg-slate-50 p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800/40 dark:ring-slate-700">
      <div className="flex">
        <div className="flex-shrink-0">
          <InformationCircleIcon
            className="h-5 w-5 text-slate-500 dark:text-slate-300"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm text-slate-700 dark:text-slate-400">
            You've reached the maximum message history limit. Previous messages
            will be removed.
          </p>
        </div>
      </div>
    </div>
  );
}
