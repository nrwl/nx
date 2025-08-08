'use client';
import { useTheme } from '@nx/nx-dev-ui-theme';
import dynamic from 'next/dynamic';
import { ReactElement, useEffect, useState } from 'react';

export function Loading() {
  return (
    <div className="flex h-[450px] w-full items-center justify-center">
      <div
        className="spinner-border inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-r-slate-400 dark:border-slate-700 dark:border-r-slate-500"
        role="status"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}

/**
 * dynamic() can't be used inside of React rendering as it needs to be marked
 * in the top level of the module for preloading to work, similar to React.lazy.
 */
const NxDevProjectGraph = dynamic(
  () =>
    import('../graphs/project-graph').then(
      (module) => module.NxDevProjectGraph
    ),
  { ssr: false, loading: () => <Loading /> }
);
const NxDevTaskGraph = dynamic(
  () => import('../graphs/task-graph').then((module) => module.NxDevTaskGraph),
  { ssr: false, loading: () => <Loading /> }
);

export type GraphProps = {
  height: string;
  title: string;
  type: 'project' | 'task';
  jsonFile?: string;
  children: ReactElement;
};

export function Graph({
  height,
  title,
  type,
  jsonFile,
  children,
}: GraphProps): JSX.Element {
  const [theme] = useTheme();
  const [parsedProps, setParsedProps] = useState<any>();
  const getData = async (path: string) => {
    const response = await fetch('/documentation/' + path, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    setParsedProps(await response.json());
  };
  useEffect(() => {
    if (jsonFile) {
      getData(jsonFile);
    }
  }, [jsonFile, setParsedProps]);
  if (!jsonFile && !parsedProps) {
    if (!children || !children.hasOwnProperty('props')) {
      return (
        <div className="no-prose block rounded-md bg-red-50 p-4 text-red-700 ring-1 ring-red-100 dark:bg-red-900/30 dark:text-red-600 dark:ring-red-900">
          <p className="mb-4">
            No JSON provided for graph, use JSON code fence to embed data for
            the graph.
          </p>
        </div>
      );
    }

    try {
      setParsedProps(JSON.parse(children?.props.children as any));
    } catch {
      return (
        <div className="not-prose block rounded-md bg-red-50 p-4 text-red-700 ring-1 ring-red-100 dark:bg-red-900/30 dark:text-red-600 dark:ring-red-900">
          <p className="mb-4">Could not parse JSON for graph:</p>
          <pre className="p-4 text-sm">{children?.props.children as any}</pre>
        </div>
      );
    }
  }
  if (!parsedProps) {
    return <Loading />;
  }

  return (
    <div className="w-full place-content-center overflow-hidden rounded-md ring-1 ring-slate-200 dark:ring-slate-700">
      <div className="relative flex justify-center border-b border-slate-200 bg-slate-100/50 p-2 font-bold dark:border-slate-700 dark:bg-slate-700/50">
        {title}
      </div>
      {type === 'project' ? (
        <div style={{ height }}>
          <NxDevProjectGraph
            theme={theme}
            projects={parsedProps.projects}
            dependencies={parsedProps.dependencies}
            affectedProjects={parsedProps.affectedProjectIds}
            enableContextMenu={parsedProps.enableTooltips}
            composite={parsedProps.composite}
          />
        </div>
      ) : (
        <NxDevTaskGraph
          theme={theme}
          projects={parsedProps.projects}
          taskGraphs={parsedProps.taskGraphs}
          taskId={parsedProps.taskId}
          enableContextMenu={parsedProps.enableTooltips}
        />
      )}
    </div>
  );
}
