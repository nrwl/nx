import { useRouteError } from 'react-router-dom';

export function TasksSidebarErrorBoundary() {
  let error = useRouteError();
  console.error(error);
  return (
    <div className="mt-8 px-4">
      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        Error
      </h2>
      <p>There was a problem loading your task graph.</p>
    </div>
  );
}
