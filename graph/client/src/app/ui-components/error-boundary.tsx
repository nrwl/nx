import { ProjectDetailsHeader } from '@nx/graph-internal/project-details';
import {
  fetchProjectGraph,
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
} from '@nx/graph/shared';
import {
  isRouteErrorResponse,
  useParams,
  useRouteError,
} from 'react-router-dom';
import { ErrorPage } from './error-page';

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
      <ErrorPage
        message={message}
        stack={stack}
        errors={hasErrorData ? error.data.errors : undefined}
      />
    </div>
  );
}
