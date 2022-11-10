/* nx-ignore-next-line */
import type {
  ProjectGraphProjectNode,
  ProjectGraphDependency,
} from 'nx/src/config/project-graph';
import { useEffect, useRef, useState } from 'react';
import { GraphService } from './graph';

type Theme = 'light' | 'dark' | 'system';
export interface GraphUiGraphProps {
  projects: ProjectGraphProjectNode[];
  groupByFolder: boolean;
  workspaceLayout: { appsDir: string; libsDir: string };
  dependencies: Record<string, ProjectGraphDependency[]>;
  affectedProjectIds: string[];
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
export function NxProjectGraphViz({
  projects,
  groupByFolder,
  workspaceLayout,
  dependencies,
  affectedProjectIds,
  theme,
  height,
}: GraphUiGraphProps) {
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
          graph.handleProjectEvent({
            type: 'notifyGraphInitGraph',
            projects,
            groupByFolder,
            workspaceLayout,
            dependencies,
            affectedProjects: affectedProjectIds,
            collapseEdges: false,
          });
          graph.handleProjectEvent({ type: 'notifyGraphShowAllProjects' });
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

export default NxProjectGraphViz;
