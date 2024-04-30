import { useEnvironmentConfig } from '@nx/graph/shared';
import { ProjectDetailsHeader } from 'graph/project-details/src/lib/project-details-header';
import { useRouteError } from 'react-router-dom';

export function ErrorBoundary() {
  let error = useRouteError();
  console.error(error);
  const environment = useEnvironmentConfig()?.environment;

  let message = 'Disconnected from graph server. ';
  if (environment === 'nx-console') {
    message += 'Please refresh the page.';
  } else {
    message += 'Please rerun your command and refresh the page.';
  }

  return (
    <div className="flex h-screen w-full flex-col items-center">
      <ProjectDetailsHeader />
      <h1 className="mb-4 text-4xl dark:text-slate-100">Error</h1>
      <div>
        <p className="mb-4 text-lg dark:text-slate-200">{message}</p>
        <p className="text-sm">Error message: {error?.toString()}</p>
      </div>
    </div>
  );
}
