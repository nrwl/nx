import {
  NxGraphContextMenu,
  useGraphContextMenu,
} from '@nx/graph/context-menu';
import { useTaskGraphClient } from '@nx/graph/tasks';
import { useSelector } from '@xstate/react';
import { Tag } from '@nx/graph-ui-common';
import { useEffect } from 'react';
import { Interpreter } from 'xstate';
import {
  TaskGraphStateMachineContext,
  TaskGraphStateMachineEvents,
} from './task-graph.machine';

export function TaskGraphApp({
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
  const { graphMenu } = useGraphContextMenu({
    renderGraphEventBus: graphClient,
  });

  const taskGraphs = useSelector(service, (state) => state.context.taskGraphs);
  const projects = useSelector(service, (state) => state.context.projects);

  useEffect(() => {
    if (!graphClient) return;

    send({
      type: 'initGraph',
      projects,
      taskGraphs,
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
            task: ({ data }) => (
              <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2">
                  <Tag>{data.executor || 'task'}</Tag>
                  <span className="font-mono">{data.label || data.id}</span>
                </div>
                {data.description ? (
                  <p className="mt-4">{data.description}</p>
                ) : null}
              </div>
            ),
          }}
        </NxGraphContextMenu>
      ) : null}
    </div>
  );
}
