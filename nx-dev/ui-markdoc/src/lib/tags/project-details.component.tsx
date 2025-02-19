'use client';
import {
  createRef,
  JSX,
  ReactElement,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { ProjectDetails as ProjectDetailsUi } from '@nx/graph-internal/ui-project-details';
import { ExpandedTargetsProvider } from '@nx/graph/legacy/shared';
import { twMerge } from 'tailwind-merge';

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

export function ProjectDetails({
  height,
  title,
  jsonFile,
  expandedTargets = [],
  children,
}: {
  height: string;
  title: string;
  jsonFile?: string;
  expandedTargets?: string[];
  children: ReactElement;
}): JSX.Element {
  const [parsedProps, setParsedProps] = useState<any>();
  const elementRef = createRef<HTMLDivElement>();
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

  useLayoutEffect(() => {
    if (elementRef && expandedTargets?.length > 0) {
      const header = document.getElementById('target-' + expandedTargets[0]);
      const container = document.getElementById('project-details-container');
      if (header && container) {
        const groupHeaderOffset =
          header
            .closest('[id^="target-group-container-"]')
            ?.querySelector('[id^="target-group-header-"]')
            ?.getBoundingClientRect().height ?? 0;
        elementRef.current?.scrollTo({
          top:
            header?.getBoundingClientRect().top -
            container.getBoundingClientRect()?.top -
            groupHeaderOffset,
          behavior: 'instant',
        });
      }
    }
  }, [elementRef, expandedTargets]);

  if (!jsonFile && !parsedProps) {
    if (!children || !children.hasOwnProperty('props')) {
      return (
        <div className="no-prose my-6 block rounded-md bg-red-50 p-4 text-red-700 ring-1 ring-red-100 dark:bg-red-900/30 dark:text-red-600 dark:ring-red-900">
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
        <div className="not-prose my-6 block rounded-md bg-red-50 p-4 text-red-700 ring-1 ring-red-100 dark:bg-red-900/30 dark:text-red-600 dark:ring-red-900">
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
      {title && (
        <div className="relative flex justify-center border-b border-slate-200 bg-slate-100/50 p-2 font-bold dark:border-slate-700 dark:bg-slate-700/50">
          {title}
        </div>
      )}
      <div
        id="project-details-container"
        className={twMerge('not-prose', height && 'overflow-y-auto')}
        style={{ height }}
        ref={elementRef}
      >
        <div className="m-4">
          <ExpandedTargetsProvider initialExpanededTargets={expandedTargets}>
            <ProjectDetailsUi
              project={parsedProps.project}
              sourceMap={parsedProps.sourceMap}
              variant="compact"
            />
          </ExpandedTargetsProvider>
        </div>
      </div>
    </div>
  );
}
