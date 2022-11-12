/* nx-ignore-next-line */
import type { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import { useEffect, useRef, useState } from 'react';
import { GraphService } from './graph';
import { TaskGraphRecord } from './interfaces';

type Theme = 'light' | 'dark' | 'system';

export interface TaskGraphUiGraphProps {
  projects: ProjectGraphProjectNode[];
  taskGraphs: TaskGraphRecord;
  taskId: string;
  theme: Theme;
  height: string;
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
}: TaskGraphUiGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<GraphService>(null);
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
            type: 'notifiyTaskGraphSetProjects',
            projects,
            taskGraphs,
          });
          graph.handleTaskEvent({
            type: 'notifyTaskGraphTaskSelected',
            taskId,
          });
          setGraph(graph);
        });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ width: '100%', height }}
    ></div>
  );
}

export default NxTaskGraphViz;
