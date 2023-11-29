// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';
import Target from './target';

import PropertyRenderer from './property-renderer';
import { useRouteLoaderData } from 'react-router-dom';

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphProjectNode } from '@nx/devkit';

export function ProjectDetails() {
  const {
    project: {
      name,
      data: { targets, root, ...projectData },
    },
    sourceMap,
  } = useRouteLoaderData('selectedProjectDetails') as {
    project: ProjectGraphProjectNode;
    sourceMap: Record<string, string[]>;
  };

  return (
    <div className="m-4 overflow-auto">
      <h1 className="text-2xl">{name}</h1>
      <h2 className="text-lg pl-6 mb-3 flex flex-row gap-2">
        {root}{' '}
        {projectData.tags?.map((tag) => (
          <p className="bg-slate-300">{tag}</p>
        ))}
      </h2>
      <div>
        <div className="mb-2">
          <h2 className="text-xl">Targets</h2>
          {Object.entries(targets ?? {}).map(([targetName, target]) =>
            Target({
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
            key === 'files'
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
