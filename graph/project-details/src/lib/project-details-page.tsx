/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

import {
  ScrollRestoration,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { ProjectDetailsWrapper } from './project-details-wrapper';
import {
  ExpandedTargetsProvider,
  fetchProjectGraph,
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
} from '@nx/graph/shared';
import { ProjectDetailsHeader } from './project-details-header';

export function ProjectDetailsPage() {
  const { project, sourceMap, hash, errors, connectedToCloud } =
    useRouteLoaderData('selectedProjectDetails') as {
      hash: string;
      project: ProjectGraphProjectNode;
      sourceMap: Record<string, string[]>;
      errors?: GraphError[];
      connectedToCloud?: boolean;
    };

  const { environment, watch, appConfig } = useEnvironmentConfig();

  const projectGraphDataService = getProjectGraphDataService();
  const params = useParams();

  usePoll(
    async () => {
      const data = await fetchProjectGraph(
        projectGraphDataService,
        params,
        appConfig
      );
      if (data?.hash !== hash) {
        window.location.reload();
      }
    },
    1000,
    watch
  );

  return (
    <ExpandedTargetsProvider>
      <div className="flex w-full flex-col justify-center text-slate-700 dark:text-slate-400">
        <ScrollRestoration />
        {environment !== 'nx-console' ? (
          <ProjectDetailsHeader />
        ) : (
          <div className="py-2"></div>
        )}
        <div className="mx-auto mb-8 w-full max-w-6xl flex-grow px-8">
          <ProjectDetailsWrapper
            project={project}
            sourceMap={sourceMap}
            errors={errors}
            connectedToCloud={connectedToCloud}
          ></ProjectDetailsWrapper>
        </div>
      </div>
    </ExpandedTargetsProvider>
  );
}
