import { useTheme } from '@nrwl/nx-dev/ui-theme';
import dynamic from 'next/dynamic';
import { ReactElement } from 'react';

/**
 * dynamic() can't be used inside of React rendering as it needs to be marked
 * in the top level of the module for preloading to work, similar to React.lazy.
 */
const NxProjectGraphViz = dynamic(
  () =>
    import('@nrwl/graph/ui-graph').then((module) => module.NxProjectGraphViz),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[450px] w-full items-center justify-center">
        <div
          className="spinner-border inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-100 border-r-slate-400 dark:border-slate-700 dark:border-r-slate-500"
          role="status"
        >
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    ),
  }
);
const NxTaskGraphViz = dynamic(
  () => import('@nrwl/graph/ui-graph').then((module) => module.NxTaskGraphViz),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[450px] w-full items-center justify-center">
        <div
          className="spinner-border inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-100 border-r-slate-400 dark:border-slate-700 dark:border-r-slate-500"
          role="status"
        >
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    ),
  }
);

export function Graph({
  height,
  type,
  children,
}: {
  height: string;
  type: 'project' | 'task';
  children: ReactElement;
}): JSX.Element {
  const [theme] = useTheme();

  if (!children || !children.hasOwnProperty('props'))
    return (
      <div className="no-prose my-6 block rounded-md bg-red-50 p-4 text-red-700 ring-1 ring-red-100 dark:bg-red-900/30 dark:text-red-600 dark:ring-red-900">
        <p className="mb-4">
          No JSON provided for graph, use JSON code fence to embed data for the
          graph.
        </p>
      </div>
    );

  let parsedProps;
  try {
    parsedProps = JSON.parse(children?.props.children as any);
  } catch {
    return (
      <div className="not-prose my-6 block rounded-md bg-red-50 p-4 text-red-700 ring-1 ring-red-100 dark:bg-red-900/30 dark:text-red-600 dark:ring-red-900">
        <p className="mb-4">Could not parse JSON for graph:</p>
        <pre className="p-4 text-sm">{children?.props.children as any}</pre>
      </div>
    );
  }

  return (
    <div className="my-6 w-full place-content-center overflow-hidden rounded-md ring-1 ring-slate-100 dark:ring-slate-700">
      {type === 'project' ? (
        <NxProjectGraphViz
          height={height}
          groupByFolder={false}
          theme={theme}
          projects={parsedProps.projects}
          workspaceLayout={parsedProps.workspaceLayout}
          dependencies={parsedProps.dependencies}
          affectedProjectIds={parsedProps.affectedProjectIds}
        />
      ) : (
        <NxTaskGraphViz
          height={height}
          theme={theme}
          projects={parsedProps.projects}
          taskGraphs={parsedProps.taskGraphs}
          taskId={parsedProps.taskId}
        />
      )}
    </div>
  );
}
