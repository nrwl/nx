import { isWholeFileChange, WholeFileChange } from '../../file-utils';
import { DiffType, isJsonChange, JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedNpmPackages: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, workspaceJson, nxJson, packageJson): string[] => {
  const packageJsonChange = touchedFiles.find(f => f.file === 'package.json');
  if (!packageJsonChange) return;

  let touched = [];
  const changes = packageJsonChange.getChanges();

  for (const c of changes) {
    if (
      isJsonChange(c) &&
      (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies')
    ) {
      // A package was deleted so mark all packages as touched
      // so projects with any package dependency will be affected.
      if (c.type === DiffType.Deleted) {
        touched = Object.keys({
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        });
        break;
      } else {
        touched.push(c.path[1]);
      }
    } else if (isWholeFileChange(c)) {
      touched = Object.keys(nxJson.projects);
      break;
    }
  }

  return touched;
};
