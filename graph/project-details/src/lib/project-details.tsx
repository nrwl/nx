// eslint-disable-next-line @typescript-eslint/no-unused-vars

import { useNavigate, useRouteLoaderData } from 'react-router-dom';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';

import {
  getExternalApiService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph/shared';
import { JsonLineRenderer } from './json-line-renderer';
import { EyeIcon } from '@heroicons/react/24/outline';
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
  const { environment } = useEnvironmentConfig();
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

  // const projectDataSorted = sortObjectWithTargetsFirst(projectData);
  // return (
  //   <div className="flex flex-col w-full h-full">
  //     <div className="flex">
  //       <div className="w-12 pr-2 border-r-2 border-solid border-slate-700">
  //         <EyeIcon
  //           className="h-6 w-6 ml-3 mt-3"
  //           onClick={viewInProjectGraph}
  //         ></EyeIcon>
  //       </div>
  //       <div className="pl-6 pb-6">
  //         <h1 className="text-4xl flex items-center">
  //           <span>{name}</span>
  //         </h1>
  //         <div className="flex gap-2">
  //           <span className="text-slate-500 text-xl"> {root}</span>

  //           {projectData.tags?.map((tag) => (
  //             <div className="dark:bg-sky-500 text-white rounded px-1">
  //               {tag}
  //             </div>
  //           ))}
  //         </div>
  //       </div>
  //     </div>
  //     {JsonLineRenderer({ jsonData: projectDataSorted, sourceMap })}
  //   </div>
  // );

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
          <h2 className="text-xl">Targets</h2>
          {Object.entries(projectData.targets ?? {}).map(
            ([targetName, target]) =>
              Target({
                projectName: name,
                targetName: targetName,
                targetConfiguration: target,
                sourceMap,
              })
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

function sortObjectWithTargetsFirst(obj: any) {
  let sortedObj: any = {};

  // If 'targets' exists, set it as the first property
  if (obj.hasOwnProperty('targets')) {
    sortedObj.targets = obj.targets;
  }

  // Copy the rest of the properties
  for (let key in obj) {
    if (key !== 'targets') {
      sortedObj[key] = obj[key];
    }
  }

  return sortedObj;
}

export default ProjectDetails;
