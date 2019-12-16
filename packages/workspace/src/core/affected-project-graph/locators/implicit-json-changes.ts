import { NxJson } from '../../shared-interfaces';
import { FileChange } from '../../file-utils';
import { JsonValueDiff } from '../../../utils/json-diff';

export function getImplicitlyTouchedProjectsByJsonChanges(
  workspaceJson: any,
  nxJson: NxJson,
  touchedFiles: FileChange[]
): string[] {
  const { implicitDependencies } = nxJson;

  if (!implicitDependencies) {
    return [];
  }

  const touched = [];

  for (const f of touchedFiles) {
    if (f.file.endsWith('.json') && implicitDependencies[f.file]) {
      const changes: JsonValueDiff[] = f.getChanges();
      for (const c of changes) {
        const projects =
          getTouchedProjects(c.path, implicitDependencies[f.file]) || [];
        projects.forEach(p => touched.push(p));
      }
    }
  }

  return touched;
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
