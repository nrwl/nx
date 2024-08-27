/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
// nx-ignore-next-line
import { ProjectDetailsWrapper } from '@nx/graph-internal/project-details';
/* eslint-enable @nx/enforce-module-boundaries */
import { useFloating } from '@floating-ui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useRouteLoaderData, useSearchParams } from 'react-router-dom';

export function ProjectDetailsModal() {
  const workspaceData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { sourceMaps: string[] };
  const [project, setProject] = useState(null);
  const [sourceMap, setSourceMap] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const { refs } = useFloating({
    open: isOpen,
    strategy: 'fixed',
    placement: 'right',
  });

  useEffect(() => {
    if (searchParams.has('projectDetails')) {
      const projectName = searchParams.get('projectDetails');
      const project = workspaceData.projects.find(
        (project) => project.name === projectName
      );
      if (!project) {
        return;
      }
      const sourceMap = workspaceData.sourceMaps[project.data.root];
      setProject(project);
      setSourceMap(sourceMap);
      setIsOpen(true);
    }
  }, [searchParams, workspaceData]);

  function onClose() {
    searchParams.delete('projectDetails');
    setSearchParams(searchParams);
    setIsOpen(false);
  }

  return (
    isOpen && (
      <div
        className="fixed right-4 top-24 z-20 h-max w-1/3 bg-white opacity-100  dark:bg-slate-800"
        style={{
          height: 'calc(100vh - 6rem - 2rem)',
        }}
        ref={refs.setFloating}
      >
        <div className="h-full rounded-md border border-slate-500">
          <ProjectDetailsWrapper project={project} sourceMap={sourceMap} />
          <div className="absolute right-2 top-2" onClick={onClose}>
            <XMarkIcon className="h-4 w-4" />
          </div>
        </div>
      </div>
    )
  );
}
