/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { useNavigate, useNavigation, useSearchParams } from 'react-router-dom';
import { Spinner, ErrorToast } from '@nx/graph-ui-common';
import {
  useEnvironmentConfig,
  getExternalApiService,
  useRouteConstructor,
} from '@nx/graph-shared';
import {
  ProjectDetails,
  ExpandedTargetsContext,
} from '@nx/graph-internal-ui-project-details';
import { useCallback, useContext, useEffect } from 'react';
import { GraphStateSerializer } from '@nx/graph';
import { ProjectElement } from '@nx/graph/projects';

interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  projectId?: string;
  sourceMap: Record<string, string[]>;
  errors?: GraphError[];
  connectedToCloud?: boolean;
  disabledTaskSyncGenerators?: string[];
}

export function ProjectDetailsWrapper({
  project,
  projectId,
  sourceMap,
  errors,
  connectedToCloud,
  disabledTaskSyncGenerators,
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
      const serializedState = GraphStateSerializer.serialize({
        c: {},
        s: {
          type: 'focused',
          nodeId:
            projectId || ProjectElement.makeId('project', data.projectName),
        },
      });

      if (environment === 'nx-console') {
        return externalApiService.postEvent({
          type: 'open-project-graph',
          payload: {
            projectName: data.projectName,
            serializedProjectGraphState: serializedState,
          },
        });
      }

      navigate(
        routeConstructor(`/projects`, (searchParams) => {
          searchParams.set('graph', serializedState);
          searchParams.delete('expanded');
          return searchParams;
        })
      );
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
              pathname: `/tasks`,
              search: `?targets=${encodeURIComponent(
                data.targetName
              )}&projects=${encodeURIComponent(data.projectName)}`,
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
        projectId={projectId}
        sourceMap={sourceMap}
        onViewInProjectGraph={handleViewInProjectGraph}
        onViewInTaskGraph={handleViewInTaskGraph}
        onRunTarget={environment === 'nx-console' ? handleRunTarget : undefined}
        viewInProjectGraphPosition={
          environment === 'nx-console' ? 'bottom' : 'top'
        }
        connectedToCloud={connectedToCloud}
        onNxConnect={environment === 'nx-console' ? handleNxConnect : undefined}
        disabledTaskSyncGenerators={disabledTaskSyncGenerators}
      />
      <ErrorToast errors={errors} />
    </>
  );
}
