import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import { useTheme } from '@nrwl/nx-dev/ui-theme';

const wrapperClassNames =
  'w-full place-content-center rounded-md my-6 ring-1 ring-slate-100 dark:ring-slate-700';

export function Graph({
  height,
  children,
}: {
  height: string;
  children: ReactNode;
}): JSX.Element {
  const [theme] = useTheme();

  if (!children || !children.hasOwnProperty('props')) {
    return (
      <div className={`${wrapperClassNames} p-4`}>
        <p>No JSON provided for graph</p>
      </div>
    );
  }

  let parsedProps;
  try {
    parsedProps = JSON.parse(children?.props.children as any);
  } catch {
    return (
      <div className={`${wrapperClassNames} p-4`}>
        <p>Could not parse JSON for graph:</p>
        <pre>{children?.props.children as any}</pre>
      </div>
    );
  }

  const NxGraphViz = dynamic(
    () => import('@nrwl/graph/ui-graph').then((module) => module.NxGraphViz),
    {
      ssr: false,
      loading: () => (
        <div className={wrapperClassNames} style={{ height }}>
          Loading...
        </div>
      ),
    }
  );

  return (
    <div className={wrapperClassNames}>
      <NxGraphViz
        height={height}
        groupByFolder={false}
        theme={theme}
        projects={parsedProps.projects}
        workspaceLayout={parsedProps.workspaceLayout}
        dependencies={parsedProps.dependencies}
        affectedProjectIds={parsedProps.affectedProjectIds}
      ></NxGraphViz>
    </div>
  );
}
