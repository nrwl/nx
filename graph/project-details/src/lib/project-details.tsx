// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { useNavigate } from 'react-router-dom';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';

import { EyeIcon } from '@heroicons/react/24/outline';
import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import Target from './target';

export interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
}

export function ProjectDetails({
  project: {
    name,
    data: { root, ...projectData },
  },
  sourceMap,
}: ProjectDetailsProps) {
  const environment = useEnvironmentConfig()?.environment;
  const externalApiService = getExternalApiService();
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();

  const displayType =
    projectData.projectType &&
    projectData.projectType?.charAt(0)?.toUpperCase() +
      projectData.projectType?.slice(1);

  const viewInProjectGraph = () => {
    if (environment === 'nx-console') {
      externalApiService.postEvent({
        type: 'open-project-graph',
        payload: {
          projectName: name,
        },
      });
    } else {
      navigate(routeConstructor(`/projects/${encodeURIComponent(name)}`, true));
    }
  };

  return (
    <>
      <header className="border-b border-slate-900/10 mb-4 dark:border-slate-300/10">
        <h1 className="text-6xl flex items-center mb-4 gap-2">
          {name}{' '}
          {environment === 'nx-console' ? (
            <EyeIcon className="h-5 w-5" onClick={viewInProjectGraph}></EyeIcon>
          ) : null}{' '}
        </h1>
        <div className="p-4">
          {projectData.tags ? (
            <p>
              {projectData.tags?.map((tag) => (
                <span className="bg-slate-300 rounded-md p-1 mr-2">{tag}</span>
              ))}
            </p>
          ) : null}
          <p>
            <span className="font-bold">Root:</span> {root}
          </p>
          {displayType ? (
            <p>
              <span className="font-bold">Type:</span> {displayType}
            </p>
          ) : null}
        </div>
      </header>
      <div>
        <h2 className="text-3xl mb-2">Targets</h2>
        <ul>
          {Object.entries(projectData.targets ?? {}).map(
            ([targetName, target]) => {
              const props = {
                projectName: name,
                targetName: targetName,
                targetConfiguration: target,
                sourceMap,
              };
              return (
                <li className="mb-4">
                  <Target {...props} />
                </li>
              );
            }
          )}
        </ul>
      </div>
    </>
  );
}

export default ProjectDetails;
