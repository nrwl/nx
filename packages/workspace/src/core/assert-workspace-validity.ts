import type {
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { output } from '../utilities/output';

export function assertWorkspaceValidity(
  workspaceJson: WorkspaceJsonConfiguration,
  nxJson: NxJsonConfiguration
) {
  const projects = {
    ...workspaceJson.projects,
  };

  const invalidImplicitDependencies = new Map<string, string[]>();

  Object.entries<'*' | string[] | ImplicitJsonSubsetDependency>(
    nxJson.implicitDependencies || {}
  )
    .reduce((acc, entry) => {
      function recur(value, acc = [], path: string[]) {
        // do nothing if '*' , calculated and always valid.
        if (value !== '*' && typeof value === 'string') {
          // This is invalid because the only valid string is '*'
          output.error({
            title: 'Configuration Error',
            bodyLines: [
              `nx.json is not configured properly. "${path.join(
                ' > '
              )}" is improperly configured to implicitly depend on "${value}" but should be an array of project names or "*".`,
            ],
          });
          process.exit(1);
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

  Object.keys(projects)
    .filter((projectName) => {
      const project = workspaceJson.projects[projectName];
      return !!project.implicitDependencies;
    })
    .reduce((map, projectName) => {
      const project = workspaceJson.projects[projectName];
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
