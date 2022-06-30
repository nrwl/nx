import { flatten } from 'flat';
import * as minimatch from 'minimatch';
import { WholeFileChange } from '../../file-utils';
import {
  isJsonChange,
  JsonChange,
  walkJsonTree,
} from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { ImplicitDependencyEntry } from '../../../config/nx-json';

export const getImplicitlyTouchedProjectsByJsonChanges: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, projects, nxJson): string[] => {
  const { implicitDependencies } = nxJson;

  if (!implicitDependencies) {
    return [];
  }

  const touched = new Set<string>();

  const allProjectNames = Object.keys(projects);
  for (const f of touchedFiles) {
    if (f.file.endsWith('.json') && implicitDependencies[f.file]) {
      const changes = f.getChanges();
      for (const c of changes) {
        if (isJsonChange(c)) {
          const projects =
            getTouchedProjects(
              c.path,
              implicitDependencies[f.file],
              allProjectNames
            ) || [];
          projects.forEach((p) => touched.add(p));
        } else {
          const projects = getTouchedProjectsByJsonFile(
            implicitDependencies,
            f.file
          );
          projects.forEach((p) => touched.add(p));
        }
      }
    }
  }

  return [...touched];
};

function getTouchedProjectsByJsonFile(
  implicitDependencies: ImplicitDependencyEntry<string[]>,
  file: string
): any[] {
  let projects = [];
  walkJsonTree(implicitDependencies[file], [], (p, value) => {
    if (Array.isArray(value)) {
      projects.push(...value);
    }
    return !Array.isArray(value);
  });
  return projects;
}

function getTouchedProjects(
  path: string[],
  implicitDependencyConfig: any,
  allProjects: string[]
): string[] {
  const flatConfig = flatten<any, any>(implicitDependencyConfig, {
    safe: true,
  });
  const flatPath = path.join('.');

  for (const key in flatConfig) {
    if (minimatch(flatPath, key)) {
      const value = flatConfig[key];
      if (value === '*') return allProjects;
      if (Array.isArray(value)) return value;
      return [];
    }
  }

  return [];
}
