import { workspaceFileName } from './file-utils';
import type {
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
} from '@nrwl/devkit';
import { output } from '../utilities/output';
import { stripIndents } from '@nrwl/devkit';

export function assertWorkspaceValidity(
  workspaceJson,
  nxJson: NxJsonConfiguration
) {
  const workspaceJsonProjects = Object.keys(workspaceJson.projects);

  const projects = {
    ...workspaceJson.projects,
  };

  const invalidImplicitDependencies = new Map<string, string[]>();

  Object.entries<'*' | string[] | ImplicitJsonSubsetDependency>(
    nxJson.implicitDependencies || {}
  )
    .reduce((acc, entry) => {
      function recur(value, acc = [], path: string[]) {
        if (value === '*') {
          // do nothing since '*' is calculated and always valid.
        } else if (typeof value === 'string') {
          // This is invalid because the only valid string is '*'
          throw new Error(stripIndents`
         Configuration Error 
         nx.json is not configured properly. "${path.join(
           ' > '
         )}" is improperly configured to implicitly depend on "${value}" but should be an array of project names or "*".
          `);
        } else if (Array.isArray(value)) {
          acc.push([entry[0], value]);
        } else {
          Object.entries(value).forEach(([k, v]) => {
            recur(v, acc, [...path, k]);
          });
        }
      }

      recur(entry[1], acc, [entry[0]]);
      return acc;
    }, [])
    .reduce((map, [filename, projectNames]: [string, string[]]) => {
      detectAndSetInvalidProjectValues(map, filename, projectNames, projects);
      return map;
    }, invalidImplicitDependencies);

  workspaceJsonProjects
    .filter((projectName) => {
      const project = projects[projectName];
      return !!project.implicitDependencies;
    })
    .reduce((map, projectName) => {
      const project = projects[projectName];
      detectAndSetInvalidProjectValues(
        map,
        projectName,
        project.implicitDependencies,
        projects
      );
      return map;
    }, invalidImplicitDependencies);

  if (invalidImplicitDependencies.size === 0) {
    return;
  }

  let message = `The following implicitDependencies specified in project configurations are invalid:
  `;
  invalidImplicitDependencies.forEach((projectNames, key) => {
    const str = `  ${key}
    ${projectNames.map((projectName) => `    ${projectName}`).join('\n')}`;
    message += str;
  });

  throw new Error(`Configuration Error\n${message}`);
}

function detectAndSetInvalidProjectValues(
  map: Map<string, string[]>,
  sourceName: string,
  desiredProjectNames: string[],
  validProjects: any
) {
  const invalidProjects = desiredProjectNames.filter(
    (projectName) => !validProjects[projectName]
  );
  if (invalidProjects.length > 0) {
    map.set(sourceName, invalidProjects);
  }
}
