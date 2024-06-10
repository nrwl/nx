import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export function WarningMessage(): JSX.Element {
  return (
    <div className="rounded-md bg-yellow-50 p-4 ring-1 ring-yellow-100 dark:bg-yellow-900/30 dark:ring-yellow-900">
      <h3 className="flex gap-x-3 text-sm font-medium text-yellow-600 dark:text-yellow-400">
        <ExclamationTriangleIcon
          className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
          aria-hidden="true"
        />{' '}
        Always double check!
      </h3>
      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-600">
        <p>
          The results may not be accurate, so please always double check with
          our documentation.
        </p>
      </div>
    </div>
  );
}
