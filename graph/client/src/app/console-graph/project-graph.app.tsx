import {
  useProjectGraphClient,
  useProjectGraphContext,
} from '@nx/graph/projects';
import { useSelector } from '@xstate/react';
import { useEffect } from 'react';
import { Interpreter } from 'xstate';
import { ProjectGraphEvents, ProjectGraphState } from './project-graph.machine';

export function ProjectGraphApp({
  service,
}: {
  service: Interpreter<ProjectGraphState, any, ProjectGraphEvents>;
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
      dependencies: projectGraph.dependencies,
      affectedProjects: [],
    });

    send({
      type: 'showAll',
      autoExpand: true,
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
