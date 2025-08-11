import {
  useProjectGraphClient,
  useProjectGraphContext,
} from '@nx/graph/projects';
import { useSelector } from '@xstate/react';
import { useEffect } from 'react';
import { Interpreter } from 'xstate';
import {
  ProjectGraphStateMachineEvents,
  ProjectGraphStateMachineContext,
} from './project-graph.machine';
import { useTaskGraphClient } from '@nx/graph/tasks/use-task-graph-client';
import {
  TaskGraphStateMachineEvents,
  TaskGraphStateMachineContext,
} from './task-graph.machine';

export function ProjectGraphApp({
  service,
}: {
  service: Interpreter<
    TaskGraphStateMachineContext,
    any,
    TaskGraphStateMachineEvents
  >;
}) {
  const {
    containerRef,
    graphClient,
    sendRenderConfigEvent,
    send,
    handleEventResult,
  } = useTaskGraphClient({
    renderPlatform: 'nx-console',
    styles: [],
  });
  const projectGraph = useSelector(
    service,
    (state) => state.context.projectGraph
  );

  useEffect(() => {
    if (!graphClient) return;

    service.send({
      type: 'setGraphClient',
      graphClient: { graphClient, send, sendRenderConfigEvent },
    });
  }, [graphClient]);

  useEffect(() => {
    console.log('graph client', graphClient);
    console.log('projectGraph', projectGraph);
    if (!graphClient || !projectGraph) return;

    send({
      type: 'initGraph',
      projects: Object.values(projectGraph.nodes),
      taskGraphs: {},
    });
  }, [graphClient]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>
    </div>
  );
}
