import { ProjectDetailsHeader } from '@nx/graph/project-details';
import {
  fetchProjectGraph,
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
} from '@nx/graph/shared';
import { ErrorRenderer } from '@nx/graph/ui-components';
import {
  isRouteErrorResponse,
  useParams,
  useRouteError,
} from 'react-router-dom';

export function ErrorBoundary() {
  let error = useRouteError();
  console.error(error);

  const { environment, appConfig, watch } = useEnvironmentConfig();
  const projectGraphDataService = getProjectGraphDataService();
  const params = useParams();

  const hasErrorData =
    isRouteErrorResponse(error) && error.data.errors?.length > 0;

  usePoll(
    async () => {
      const data = await fetchProjectGraph(
        projectGraphDataService,
        params,
        appConfig
      );
      if (
        isRouteErrorResponse(error) &&
        error.data.id === 'project-not-found' &&
        data.projects.find((p) => p.name === error.data.projectName)
      ) {
        window.location.reload();
      }
    },
    1000,
    watch
  );

  let message: string | JSX.Element;
  let stack: string;
  if (isRouteErrorResponse(error) && error.data.id === 'project-not-found') {
    message = (
      <p>
        Project <code>{error.data.projectName}</code> not found.
      </p>
    );
  } else {
    message = 'Disconnected from graph server. ';
    if (environment === 'nx-console') {
      message += 'Please refresh the page.';
    } else {
      message += 'Please rerun your command and refresh the page.';
    }
    stack = error.toString();
  }

  return (
    <div className="flex h-screen w-full flex-col items-center">
      {environment !== 'nx-console' && <ProjectDetailsHeader />}
      <div className="mx-auto mb-8 w-full max-w-6xl flex-grow px-8">
        <h1 className="mb-4 text-4xl dark:text-slate-100">Error</h1>
        <div>
          <ErrorWithStack message={message} stack={stack} />
        </div>
        {hasErrorData && (
          <div>
            <p className="text-md mb-4 dark:text-slate-200">
              Nx encountered the following issues while processing the project
              graph:{' '}
            </p>
            <div>
              <ErrorRenderer errors={error.data.errors} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorWithStack({
  message,
  stack,
}: {
  message: string | JSX.Element;
  stack?: string;
}) {
  return (
    <div>
      <p className="mb-4 text-lg dark:text-slate-100">{message}</p>
      {stack && <p className="text-sm">Error message: {stack}</p>}
    </div>
  );
}
