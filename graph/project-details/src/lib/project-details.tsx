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
import PropertyRenderer from './property-renderer';
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
  const routeContructor = useRouteConstructor();

  const viewInProjectGraph = () => {
    if (environment === 'nx-console') {
      externalApiService.postEvent({
        type: 'open-project-graph',
        payload: {
          projectName: name,
        },
      });
    } else {
      navigate(routeContructor(`/projects/${encodeURIComponent(name)}`, true));
    }
  };

  return (
    <div className="m-4 overflow-auto w-full">
      <h1 className="text-2xl flex items-center gap-2">
        {name}{' '}
        <EyeIcon className="h-5 w-5" onClick={viewInProjectGraph}></EyeIcon>
      </h1>
      <h2 className="text-lg pl-6 mb-3 flex flex-row gap-2">
        {root}{' '}
        {projectData.tags?.map((tag) => (
          <p className="bg-slate-300">{tag}</p>
        ))}
      </h2>
      <div>
        <div className="mb-2">
          <h2 className="text-xl mb-2">Targets</h2>
          {Object.entries(projectData.targets ?? {}).map(
            ([targetName, target]) => {
              const props = {
                projectName: name,
                targetName: targetName,
                targetConfiguration: target,
                sourceMap,
              };
              return <Target {...props} />;
            }
          )}
        </div>
        {Object.entries(projectData).map(([key, value]) => {
          if (
            key === 'targets' ||
            key === 'root' ||
            key === 'name' ||
            key === '$schema' ||
            key === 'tags' ||
            key === 'files' ||
            key === 'sourceRoot'
          )
            return undefined;

          return PropertyRenderer({
            propertyKey: key,
            propertyValue: value,
            sourceMap,
          });
        })}
      </div>
    </div>
  );
}

export default ProjectDetails;
