import { useEnvironmentConfig } from '@nx/graph/shared';
import { ProjectDetailsHeader } from 'graph/project-details/src/lib/project-details-header';
import { useRouteError } from 'react-router-dom';

export function ErrorBoundary() {
  let error = useRouteError()?.toString();
  console.error(error);
  const environment = useEnvironmentConfig()?.environment;

  let message = 'Disconnected from graph server. ';
  if (environment === 'nx-console') {
    message += 'Please refresh the page.';
  } else {
    message += 'Please rerun your command and refresh the page.';
  }

  return (
    <div className="flex flex-col items-center h-screen w-full">
      <ProjectDetailsHeader />
      <h1 className="text-4xl mb-4 dark:text-slate-100">Error</h1>
      <div>
        <p className="text-lg mb-4 dark:text-slate-200">{message}</p>
        <p className="text-sm">Error message: {error}</p>
      </div>
    </div>
  );
}
