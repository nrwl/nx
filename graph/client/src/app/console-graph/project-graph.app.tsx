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

export function ProjectGraphApp({
  service,
}: {
  service: Interpreter<
    ProjectGraphStateMachineContext,
    any,
    ProjectGraphStateMachineEvents
  >;
}) {
  const {
    containerRef,
    graphClient,
    sendRenderConfigEvent,
    send,
    handleEventResult,
  } = useProjectGraphClient({
    renderPlatform: 'nx-console',
    styles: [],
  });
  const projectGraph = useSelector(
    service,
    (state) => state.context.projectGraph
  );

  const initialCommand = useSelector(
    service,
    (state) => state.context.initialCommand
  );

  useEffect(() => {
    if (!graphClient) return;

    service.send({
      type: 'setGraphClient',
      graphClient: { graphClient, send, sendRenderConfigEvent },
    });
  }, [graphClient]);

  useEffect(() => {
    if (!graphClient || !projectGraph) return;

    send({
      type: 'initGraph',
      projects: Object.values(projectGraph.nodes),
      dependencies: projectGraph.dependencies,
      affectedProjects: [],
    });
    if (initialCommand) {
      send(initialCommand);
    }
    console.log('initGraph called');
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
