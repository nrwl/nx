/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { useFloating } from '@floating-ui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ProjectDetailsWrapper } from '@nx/graph/project-details';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
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
        className="top-24 z-20 right-4 opacity-100 bg-white dark:bg-slate-800 fixed h-max  w-1/3"
        style={{
          height: 'calc(100vh - 6rem - 2rem)',
        }}
        ref={refs.setFloating}
      >
        <div className="rounded-md h-full border border-slate-500">
          <ProjectDetailsWrapper project={project} sourceMap={sourceMap} />
          <div className="top-2 right-2 absolute" onClick={onClose}>
            <XMarkIcon className="h-4 w-4" />
          </div>
        </div>
      </div>
    )
  );
}
