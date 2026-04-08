'use client';

import type { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import { TaskGraph } from 'nx/src/config/task-graph';
import { useCallback, useEffect, useMemo } from 'react';
import { RenderTheme } from '@nx/graph';
import { NxGraphTaskGraphProvider, useTaskGraphContext } from '@nx/graph/tasks';
import { useThemeSync } from './resolve-theme';
import {
  NxGraphElementPanel,
  NxGraphTaskNodePanelContent,
  NxGraphTaskNodePanelHeader,
  useElementPanel,
} from '@nx/graph/ui';

interface NxDevTaskGraphProps {
  theme: RenderTheme | 'system';
  projects: ProjectGraphProjectNode[];
  taskGraph: TaskGraph;
  taskId: string;
  taskIds?: string[];
  enableContextMenu?: boolean;
}

export function NxDevTaskGraph(props: NxDevTaskGraphProps) {
  return (
    <NxGraphTaskGraphProvider renderPlatform="nx-dev">
      <NxDevTaskGraphInner {...props} />
    </NxGraphTaskGraphProvider>
  );
}

export function NxDevTaskGraphInner({
  projects,
  taskGraph,
  taskId,
  taskIds = [],
  theme = 'system',
  enableContextMenu = false,
}: NxDevTaskGraphProps) {
  const graphContext = useTaskGraphContext();
  const { containerRef, orchestrator, sendRendererConfigEvent, send } =
    graphContext;

  const eventBus = useMemo(
    () => (enableContextMenu ? orchestrator : null),
    [orchestrator, enableContextMenu]
  );

  const [element] = useElementPanel(eventBus);

  const handleThemeChange = useCallback(
    (resolvedTheme: RenderTheme) => {
      sendRendererConfigEvent({
        type: 'themeChange',
        theme: resolvedTheme,
      });
    },
    [sendRendererConfigEvent]
  );

  useThemeSync(theme, handleThemeChange);

  useEffect(() => {
    if (!orchestrator) return;

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

    // make sure the graph sized to fix into the box
    const el = orchestrator['renderer'].cy.elements();
    orchestrator['renderer'].cy.fit(el, 10).center().resize();
    // other values are static from the docs and we don't need to update for them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orchestrator, send]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>

      <NxGraphElementPanel
        element={element}
        panelContainerClassName="border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        panelHeaderClassName="border-zinc-300 dark:border-zinc-700"
        panelContentContainerClassName="divide-zinc-300 dark:divide-zinc-700"
        header={{
          task: (element, { open, close }) => (
            <NxGraphTaskNodePanelHeader
              element={element}
              open={open}
              close={close}
              elementNameClassName="text-zinc-900 dark:text-zinc-100"
              closeButtonClassName="hover:bg-zinc-100 dark:hover:bg-zinc-700"
              taskFlagBadgeClassName="bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600"
            />
          ),
        }}
      >
        {{
          task: (element) => (
            <NxGraphTaskNodePanelContent
              element={element}
              sectionHeadingClassName="text-zinc-900 dark:text-zinc-100"
              sectionTextClassName="text-zinc-700 dark:text-zinc-300"
              actionButtonClassName="bg-zinc-100/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 border-zinc-300 dark:border-zinc-600"
              sectionListContainerClassName="border-zinc-200 dark:border-zinc-700"
              sectionListSectionClassName="bg-zinc-50 dark:bg-zinc-800"
              sectionListHeaderClassName="text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800"
              sectionListHeaderLabelClassName="text-zinc-600 dark:text-zinc-400"
              sectionListItemsClassName="divide-zinc-200 dark:divide-zinc-600"
              sectionListItemClassName="bg-zinc-50 dark:bg-zinc-700"
              sectionListItemLabelClassName="text-zinc-900 dark:text-zinc-100"
              loadingSkeletonHeaderClassName="bg-zinc-200 dark:bg-zinc-600"
              loadingSkeletonItemClassName="bg-zinc-100 dark:bg-zinc-700"
              loadingSkeletonListClassName="bg-zinc-50 dark:bg-zinc-800"
            />
          ),
        }}
      </NxGraphElementPanel>
    </div>
  );
}
