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
import { useGraphContextMenu } from '@nx/graph/context-menu/use-graph-context-menu';
import { Tag } from 'graph/ui-common/src';

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
  const { graphMenu } = useGraphContextMenu({
    renderGraphEventBus: graphClient,
  });

  const projectGraph = useSelector(
    service,
    (state) => state.context.projectGraph
  );

  useEffect(() => {
    if (!graphClient) return;

    send({
      type: 'initGraph',
      projects: Object.values(projectGraph.nodes),
      dependencies: projectGraph.dependencies,
      affectedProjects: [],
    });
    console.log('initGraph called');

    service.send({
      type: 'setGraphClient',
      graphClient: { graphClient, send, sendRenderConfigEvent },
    });
  }, [graphClient]);

  // Emit graph client results through the state machine so consumers can observe them
  useEffect(() => {
    if (!handleEventResult) return;
    service.send({
      type: 'handleEventResult',
      result: handleEventResult,
    });
  }, [handleEventResult]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>

      {graphMenu ? (
        <NxGraphContextMenu
          menu={graphMenu.props}
          virtualElement={graphMenu.virtualElement}
          placement="top"
          menuItemsContainerClassName="dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
        >
          {{
            project: ({ data }) => (
              <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Tag>{data.projectType}</Tag>
                  <span className="font-mono">{data.label}</span>
                </div>
                {data.tags.length > 0 ? (
                  <p className="my-2 lowercase">
                    <strong>tags</strong>
                    <br></br>
                    {data.tags.join(', ')}
                  </p>
                ) : null}
                {data.description ? (
                  <p className="mt-4">{data.description}</p>
                ) : null}
              </div>
            ),
            compositeProject: ({ data }) => (
              <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Tag>Composite</Tag>
                  <span className="font-mono">{data.label}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {data.compositeSize > 0 && (
                    <p>
                      <strong>Nested directories: </strong>
                      {data.compositeSize}
                    </p>
                  )}
                  {data.projectSize > 0 && (
                    <p>
                      <strong>Projects: </strong>
                      {data.projectSize}
                    </p>
                  )}
                </div>
              </div>
            ),
          }}
        </NxGraphContextMenu>
      ) : null}
    </div>
  );
}
