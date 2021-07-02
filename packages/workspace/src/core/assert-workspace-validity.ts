import { workspaceFileName } from './file-utils';
import type {
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
} from '@nrwl/devkit';
import { output } from '../utilities/output';

export function assertWorkspaceValidity(
  workspaceJson,
  nxJson: NxJsonConfiguration
) {
  const workspaceJsonProjects = Object.keys(workspaceJson.projects);
  const nxJsonProjects = Object.keys(nxJson.projects);

  if (minus(nxJsonProjects, workspaceJsonProjects).length > 0) {
    output.error({
      title: 'Configuration Error',
      bodyLines: [
        `${workspaceFileName()} and nx.json are out of sync. The following projects are missing in ${workspaceFileName()}: ${minus(
          nxJsonProjects,
          workspaceJsonProjects
        ).join(', ')}`,
      ],
    });

    process.exit(1);
  }

  const projects = {
    ...workspaceJson.projects,
    ...nxJson.projects,
  };

  const invalidImplicitDependencies = new Map<string, string[]>();

  Object.entries<'*' | string[] | ImplicitJsonSubsetDependency>(
    nxJson.implicitDependencies || {}
  )
    .reduce((acc, entry) => {
      function recur(value, acc = [], path: string[]) {
        if (typeof value === 'string') {
          // assume the string is a glob pattern that will be matched against project identifiers
          // do nothing since matching against glob pattern is always valid.
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

  nxJsonProjects
    .filter((nxJsonProjectName) => {
      const project = nxJson.projects[nxJsonProjectName];
      return !!project.implicitDependencies;
    })
    .reduce((map, nxJsonProjectName) => {
      const project = nxJson.projects[nxJsonProjectName];
      detectAndSetInvalidProjectValues(
        map,
        nxJsonProjectName,
        project.implicitDependencies,
        projects
      );
      return map;
    }, invalidImplicitDependencies);

  if (invalidImplicitDependencies.size === 0) {
    return;
  }

  let message = `The following implicitDependencies specified in nx.json are invalid:
  `;
  invalidImplicitDependencies.forEach((projectNames, key) => {
    const str = `  ${key}
    ${projectNames.map((projectName) => `    ${projectName}`).join('\n')}`;
    message += str;
  });

  output.error({
    title: 'Configuration Error',
    bodyLines: [message],
  });

  process.exit(1);
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

function minus(a: string[], b: string[]): string[] {
  const res = [];
  a.forEach((aa) => {
    if (!b.find((bb) => bb === aa)) {
      res.push(aa);
    }
  });
  return res;
}
