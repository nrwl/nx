'use client';

import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
import { TaskGraph } from 'nx/src/config/task-graph';
import { useEffect } from 'react';
import { RenderTheme } from '@nx/graph';
import { useTaskGraphClient } from '@nx/graph/tasks';
import {
  NxGraphContextMenu,
  useGraphContextMenu,
} from '@nx/graph/context-menu';
import { Tag } from '@nx/graph-ui-common';
import { resolveTheme } from './resolve-theme';

interface NxDevTaskGraphProps {
  theme: RenderTheme | 'system';
  projects: ProjectGraphProjectNode[];
  taskGraph: TaskGraph;
  taskId: string;
  taskIds?: string[];
  enableContextMenu?: boolean;
}

export function NxDevTaskGraph({
  projects,
  taskGraph,
  taskId,
  taskIds = [],
  theme = 'system',
  enableContextMenu = false,
}: NxDevTaskGraphProps) {
  const { containerRef, graphClient, sendRenderConfigEvent, send } =
    useTaskGraphClient({ renderPlatform: 'nx-dev', styles: [] });

  const { graphMenu } = useGraphContextMenu({
    renderGraphEventBus: enableContextMenu ? graphClient : null,
  });

  useEffect(() => {
    sendRenderConfigEvent({ type: 'ThemeChange', theme: resolveTheme(theme) });
  }, [theme]);

  useEffect(() => {
    if (!graphClient) return;

    const showTaskIds = taskIds.length ? taskIds : [taskId];

    send(
      { type: 'initGraph', projects, taskGraph },
      {
        type: 'show',
        taskIds: showTaskIds.map((id) =>
          id.startsWith('task-') ? id : `task-${id}`
        ),
      }
    );
  }, [graphClient]);

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
                  <Tag>{data.executor}</Tag>
                  <span className="font-mono">{data.label}</span>
                </div>

                {data.description ? <p>{data.description}</p> : null}
              </div>
            ),
          }}
        </NxGraphContextMenu>
      ) : null}
    </div>
  );
}
