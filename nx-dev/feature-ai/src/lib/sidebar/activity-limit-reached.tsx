import { InformationCircleIcon } from '@heroicons/react/24/outline';

export function ActivityLimitReached(): JSX.Element {
  return (
    <div className="rounded-md bg-zinc-50 p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-800/40 dark:ring-zinc-700">
      <div className="flex">
        <div className="flex-shrink-0">
          <InformationCircleIcon
            className="h-5 w-5 text-zinc-500 dark:text-zinc-300"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm text-zinc-700 dark:text-zinc-400">
            You've reached the maximum message history limit. Previous messages
            will be removed.
          </p>
        </div>
      </div>
    </div>
  );
}
