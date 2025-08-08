import { useProjectGraphClient } from '@nx/graph/projects';
import { useSelector } from '@xstate/react';
import { useEffect } from 'react';
import { Interpreter } from 'xstate';
import { ProjectGraphEvents, ProjectGraphState } from './project-graph.machine';

export function ProjectGraphApp({
  service,
}: {
  service: Interpreter<ProjectGraphState, any, ProjectGraphEvents>;
}) {
  const { containerRef, graphClient, sendRenderConfigEvent, send } =
    useProjectGraphClient({
      renderPlatform: 'nx-console',
      styles: [],
    });

  const projectGraph = useSelector(
    service,
    (state) => state.context.projectGraph
  );

  useEffect(() => {
    console.log('graph client', graphClient);
    if (!graphClient) return;

    send({
      type: 'initGraph',
      projects: Object.values(projectGraph.nodes),
      dependencies: projectGraph.dependencies,
      affectedProjects: [],
    });
  }, [graphClient]);

  return <div ref={containerRef} className="h-full w-full" />;
}
