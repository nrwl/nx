import { WholeFileChange } from '../../file-utils';
import {
  isJsonChange,
  JsonChange,
  walkJsonTree
} from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import { ImplicitDependencyEntry } from '../../shared-interfaces';

export const getImplicitlyTouchedProjectsByJsonChanges: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, workspaceJson, nxJson): string[] => {
  const { implicitDependencies } = nxJson;

  if (!implicitDependencies) {
    return [];
  }

  const touched = [];

  for (const f of touchedFiles) {
    if (f.file.endsWith('.json') && implicitDependencies[f.file]) {
      const changes = f.getChanges();
      for (const c of changes) {
        if (isJsonChange(c)) {
          const projects =
            getTouchedProjects(c.path, implicitDependencies[f.file]) || [];
          projects.forEach(p => touched.push(p));
        } else {
          const projects = getTouchedProjectsByJsonFile(
            implicitDependencies,
            f.file
          );
          projects.forEach(p => touched.push(p));
        }
      }
    }
  }

  return touched;
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

function getTouchedProjects(path: string[], implicitDependencyConfig: any) {
  let curr = implicitDependencyConfig;
  let found = true;
  for (const key of path) {
    if (curr[key]) {
      curr = curr[key];
    } else {
      found = false;
      break;
    }
  }
  return found ? curr : [];
}
