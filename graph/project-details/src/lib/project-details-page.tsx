/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';
import {
  ScrollRestoration,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { ProjectDetailsWrapper } from './project-details-wrapper';
import {
  fetchProjectGraph,
  getProjectGraphDataService,
  useEnvironmentConfig,
  useIntervalWhen,
} from '@nx/graph/shared';
import { ProjectDetailsHeader } from './project-details-header';

export function ProjectDetailsPage() {
  const { project, sourceMap, hash } = useRouteLoaderData(
    'selectedProjectDetails'
  ) as {
    hash: string;
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
  };

  const { environment, watch, appConfig } = useEnvironmentConfig();

  const projectGraphDataService = getProjectGraphDataService();
  const params = useParams();

  useIntervalWhen(
    async () => {
      fetchProjectGraph(projectGraphDataService, params, appConfig).then(
        (data) => {
          if (data?.hash !== hash) {
            window.location.reload();
          }
          return;
        }
      );
    },
    1000,
    watch
  );

  return (
    <div className="flex flex-col justify-center w-full text-slate-700 dark:text-slate-400">
      <ScrollRestoration />
      {environment !== 'nx-console' ? (
        <ProjectDetailsHeader />
      ) : (
        <div className="py-2"></div>
      )}
      <div className="flex-grow mx-auto w-full max-w-6xl px-8 mb-8">
        <ProjectDetailsWrapper
          project={project}
          sourceMap={sourceMap}
        ></ProjectDetailsWrapper>
      </div>
    </div>
  );
}
