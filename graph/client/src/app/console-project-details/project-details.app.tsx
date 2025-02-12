import { ProjectDetails } from '@nx/graph-internal/ui-project-details';
import {
  ErrorToastUI,
  ExpandedTargetsProvider,
  getExternalApiService,
} from '@nx/graph/shared';
import { useSelector } from '@xstate/react';
import { useCallback } from 'react';
import { Interpreter } from 'xstate';
import {
  ProjectDetailsEvents,
  ProjectDetailsState,
} from './project-details.machine';

export function ProjectDetailsApp({
  service,
}: {
  service: Interpreter<ProjectDetailsState, any, ProjectDetailsEvents>;
}) {
  const externalApiService = getExternalApiService();

  const project = useSelector(service, (state) => state.context.project);
  const sourceMap = useSelector(service, (state) => state.context.sourceMap);
  const errors = useSelector(service, (state) => state.context.errors);
  const connectedToCloud = useSelector(
    service,
    (state) => state.context.connectedToCloud
  );
  const disabledTaskSyncGenerators = useSelector(
    service,
    (state) => state.context.disabledTaskSyncGenerators
  );

  const handleViewInProjectGraph = useCallback(
    (data: { projectName: string }) => {
      externalApiService.postEvent({
        type: 'open-project-graph',
        payload: {
          projectName: data.projectName,
        },
      });
    },
    [externalApiService]
  );

  const handleViewInTaskGraph = useCallback(
    (data: { projectName: string; targetName: string }) => {
      externalApiService.postEvent({
        type: 'open-task-graph',
        payload: {
          projectName: data.projectName,
          targetName: data.targetName,
        },
      });
    },
    [externalApiService]
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

  if (project && sourceMap) {
    return (
      <>
        <ExpandedTargetsProvider>
          <ProjectDetails
            project={project}
            sourceMap={sourceMap}
            onViewInProjectGraph={handleViewInProjectGraph}
            onViewInTaskGraph={handleViewInTaskGraph}
            onRunTarget={handleRunTarget}
            viewInProjectGraphPosition="bottom"
            connectedToCloud={connectedToCloud}
            onNxConnect={handleNxConnect}
            disabledTaskSyncGenerators={disabledTaskSyncGenerators}
          />
        </ExpandedTargetsProvider>
        <ErrorToastUI errors={errors} />
      </>
    );
  } else {
    return null;
  }
}
