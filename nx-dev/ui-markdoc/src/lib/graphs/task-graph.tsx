'use client';

import type { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import { TaskGraph } from 'nx/src/config/task-graph';
import { useEffect, useMemo } from 'react';
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

  useThemeSync(theme, (resolvedTheme) => {
    sendRendererConfigEvent({
      type: 'themeChange',
      theme: resolvedTheme,
    });
  });

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
  }, [orchestrator]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full w-full cursor-pointer"
      ></div>

      <NxGraphElementPanel
        element={element}
        panelContainerClassName="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        panelHeaderClassName="border-slate-300 dark:border-slate-700"
        panelContentContainerClassName="divide-slate-300 dark:divide-slate-700"
        header={{
          task: (element, { open, close }) => (
            <NxGraphTaskNodePanelHeader
              element={element}
              open={open}
              close={close}
              elementNameClassName="text-slate-900 dark:text-slate-100"
              closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              taskFlagBadgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
            />
          ),
        }}
      >
        {{
          task: (element) => (
            <NxGraphTaskNodePanelContent
              element={element}
              sectionHeadingClassName="text-slate-900 dark:text-slate-100"
              sectionTextClassName="text-slate-700 dark:text-slate-300"
              actionButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
              sectionListContainerClassName="border-slate-200 dark:border-slate-700"
              sectionListSectionClassName="bg-slate-50 dark:bg-slate-800"
              sectionListHeaderClassName="text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800"
              sectionListHeaderLabelClassName="text-slate-600 dark:text-slate-400"
              sectionListItemsClassName="divide-slate-200 dark:divide-slate-600"
              sectionListItemClassName="bg-slate-50 dark:bg-slate-700"
              sectionListItemLabelClassName="text-slate-900 dark:text-slate-100"
              loadingSkeletonHeaderClassName="bg-slate-200 dark:bg-slate-600"
              loadingSkeletonItemClassName="bg-slate-100 dark:bg-slate-700"
              loadingSkeletonListClassName="bg-slate-50 dark:bg-slate-800"
            />
          ),
        }}
      </NxGraphElementPanel>
    </div>
  );
}
