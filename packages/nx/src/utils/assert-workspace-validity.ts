import { ProjectsConfigurations } from '../config/workspace-json-project-json';
import {
  ImplicitJsonSubsetDependency,
  NxJsonConfiguration,
} from '../config/nx-json';
import { findMatchingProjects } from './find-matching-projects';
import { stripIndents } from './strip-indents';

export function assertWorkspaceValidity(
  projectsConfigurations,
  nxJson: NxJsonConfiguration
) {
  const projectNames = Object.keys(projectsConfigurations.projects);
  const projectNameSet = new Set(projectNames);

  const projects = {
    ...projectsConfigurations.projects,
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
      detectAndSetInvalidProjectGlobValues(
        map,
        filename,
        projectNames,
        projects,
        projectNames,
        projectNameSet
      );
      return map;
    }, invalidImplicitDependencies);

  projectNames
    .filter((projectName) => {
      const project = projects[projectName];
      return !!project.implicitDependencies;
    })
    .reduce((map, projectName) => {
      const project = projects[projectName];
      detectAndSetInvalidProjectGlobValues(
        map,
        projectName,
        project.implicitDependencies,
        projects,
        projectNames,
        projectNameSet
      );
      return map;
    }, invalidImplicitDependencies);

  if (invalidImplicitDependencies.size === 0) {
    return;
  }

  let message = `The following implicitDependencies point to non-existent project(s):\n`;
  message += [...invalidImplicitDependencies.keys()]
    .map((key) => {
      const projectNames = invalidImplicitDependencies.get(key);
      return `  ${key}\n${projectNames
        .map((projectName) => `    ${projectName}`)
        .join('\n')}`;
    })
    .join('\n\n');
  throw new Error(`Configuration Error\n${message}`);
}

function detectAndSetInvalidProjectGlobValues(
  map: Map<string, string[]>,
  sourceName: string,
  desiredImplicitDeps: string[],
  projectConfigurations: ProjectsConfigurations['projects'],
  projectNames: string[],
  projectNameSet: Set<string>
) {
  const invalidProjectsOrGlobs = desiredImplicitDeps.filter((implicit) => {
    const projectName = implicit.startsWith('!')
      ? implicit.substring(1)
      : implicit;

    return !(
      projectConfigurations[projectName] ||
      findMatchingProjects([implicit], projectNames, projectNameSet).length
    );
  });

  if (invalidProjectsOrGlobs.length > 0) {
    map.set(sourceName, invalidProjectsOrGlobs);
  }
}
