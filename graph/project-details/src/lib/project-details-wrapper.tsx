/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { useNavigate, useNavigation, useSearchParams } from 'react-router-dom';
import {
  ErrorToast,
  ExpandedTargetsContext,
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { Spinner } from '@nx/graph/ui-components';

import { ProjectDetails } from '@nx/graph/ui-project-details';
import { useCallback, useContext, useEffect } from 'react';

interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  errors?: GraphError[];
  connectedToCloud?: boolean;
}

export function ProjectDetailsWrapper({
  project,
  sourceMap,
  errors,
  connectedToCloud,
}: ProjectDetailsProps) {
  const environment = useEnvironmentConfig()?.environment;
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const { state: navigationState, location } = useNavigation();
  const routeConstructor = useRouteConstructor();
  const [searchParams, setSearchParams] = useSearchParams();
  const { expandedTargets, setExpandedTargets, collapseAllTargets } =
    useContext(ExpandedTargetsContext);

  const handleViewInProjectGraph = useCallback(
    (data: { projectName: string }) => {
      if (environment === 'nx-console') {
        externalApiService.postEvent({
          type: 'open-project-graph',
          payload: {
            projectName: data.projectName,
          },
        });
      } else {
        navigate(
          routeConstructor(
            `/projects/${encodeURIComponent(data.projectName)}`,
            true,
            ['expanded'] // omit expanded targets from search params
          )
        );
      }
    },
    [externalApiService, routeConstructor, navigate, environment]
  );

  const handleViewInTaskGraph = useCallback(
    (data: { projectName: string; targetName: string }) => {
      if (environment === 'nx-console') {
        externalApiService.postEvent({
          type: 'open-task-graph',
          payload: {
            projectName: data.projectName,
            targetName: data.targetName,
          },
        });
      } else {
        navigate(
          routeConstructor(
            {
              pathname: `/tasks/${encodeURIComponent(data.targetName)}`,
              search: `?projects=${encodeURIComponent(data.projectName)}`,
            },
            true,
            ['expanded'] // omit expanded targets from search params
          )
        );
      }
    },
    [externalApiService, routeConstructor, navigate, environment]
  );

  const handleRunTarget = useCallback(
    (data: { projectName: string; targetName: string }) => {
      externalApiService.postEvent({
        type: 'run-task',
        payload: { taskId: `${data.projectName}:${data.targetName}` },
      });
    },
    [externalApiService]
  );

  const handleNxConnect = useCallback(
    () =>
      externalApiService.postEvent({
        type: 'nx-connect',
      }),
    [externalApiService]
  );

  const updateSearchParams = (
    params: URLSearchParams,
    targetNames?: string[]
  ) => {
    if (!targetNames || targetNames.length === 0) {
      params.delete('expanded');
    } else {
      params.set('expanded', targetNames.join(','));
    }
  };

  useEffect(() => {
    const expandedTargetsParams = searchParams.get('expanded')?.split(',');
    if (
      expandedTargetsParams &&
      expandedTargetsParams.length > 0 &&
      setExpandedTargets
    ) {
      setExpandedTargets(expandedTargetsParams);
    }

    return () => {
      if (collapseAllTargets) {
        collapseAllTargets();
      }
    };
  }, []); // only run on mount

  useEffect(() => {
    const expandedTargetsParams =
      searchParams.get('expanded')?.split(',') || [];

    if (expandedTargetsParams.join(',') === expandedTargets?.join(',')) {
      return;
    }

    setSearchParams(
      (currentSearchParams) => {
        updateSearchParams(currentSearchParams, expandedTargets);
        return currentSearchParams;
      },
      { replace: true, preventScrollReset: true }
    );
  }, [expandedTargets, searchParams, setSearchParams]);

  if (
    navigationState === 'loading' &&
    !location.pathname.includes('project-details') // do not show spinner when updating search params
  ) {
    return (
      <div className="flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <ProjectDetails
        project={project}
        sourceMap={sourceMap}
        onViewInProjectGraph={handleViewInProjectGraph}
        onViewInTaskGraph={handleViewInTaskGraph}
        onRunTarget={environment === 'nx-console' ? handleRunTarget : undefined}
        viewInProjectGraphPosition={
          environment === 'nx-console' ? 'bottom' : 'top'
        }
        connectedToCloud={connectedToCloud}
        onNxConnect={environment === 'nx-console' ? handleNxConnect : undefined}
      />
      <ErrorToast errors={errors} />
    </>
  );
}
