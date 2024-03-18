/* eslint-disable @nx/enforce-module-boundaries */
/* nx-ignore-next-line */
import type { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { useEffect, useRef, useState } from 'react';
import { GraphService } from './graph';
import { TaskGraphRecord, TooltipEvent } from './interfaces';
import { TaskNodeTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { GraphTooltipService } from './tooltip-service';

type Theme = 'light' | 'dark' | 'system';

export interface TaskGraphUiGraphProps {
  projects: ProjectGraphProjectNode[];
  taskGraphs: TaskGraphRecord;
  taskId: string;
  theme: Theme;
  height: string;
  enableTooltips: boolean;
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme !== 'system') {
    return theme;
  } else {
    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    return darkMedia.matches ? 'dark' : 'light';
  }
}

export function NxTaskGraphViz({
  projects,
  taskId,
  taskGraphs,
  theme,
  height,
  enableTooltips,
}: TaskGraphUiGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<GraphService>(null);
  const [currentTooltip, setCurrenTooltip] = useState<TooltipEvent>(null);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>();

  const newlyResolvedTheme = resolveTheme(theme);

  if (newlyResolvedTheme !== resolvedTheme) {
    setResolvedTheme(newlyResolvedTheme);

    if (graph) {
      graph.theme = newlyResolvedTheme;
    }
  }
  useEffect(() => {
    if (containerRef.current !== null) {
      import('./graph')
        .then((module) => module.GraphService)
        .then((GraphService) => {
          const graph = new GraphService(
            containerRef.current,
            resolvedTheme,
            'nx-docs',
            'TB'
          );
          graph.handleTaskEvent({
            type: 'notifyTaskGraphSetProjects',
            projects,
            taskGraphs,
          });
          graph.handleTaskEvent({
            type: 'notifyTaskGraphSetTasks',
            taskIds: [taskId],
          });
          setGraph(graph);

          if (enableTooltips) {
            const tooltipService = new GraphTooltipService(graph);
            tooltipService.subscribe((tooltip) => {
              setCurrenTooltip(tooltip);
            });
          }
        });
    }
  }, []);

  let tooltipToRender;
  if (currentTooltip) {
    switch (currentTooltip.type) {
      case 'taskNode':
        tooltipToRender = <TaskNodeTooltip {...currentTooltip.props} />;
        break;
    }
  }

  return (
    <div className="not-prose">
      <div
        ref={containerRef}
        className="w-full cursor-pointer"
        style={{ width: '100%', height }}
      ></div>
      {tooltipToRender ? (
        <Tooltip
          content={tooltipToRender}
          open={true}
          reference={currentTooltip.ref}
          placement="top"
          openAction="manual"
        ></Tooltip>
      ) : null}
    </div>
  );
}
