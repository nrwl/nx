import { isWholeFileChange, WholeFileChange } from '../../file-utils';
import { DiffType, isJsonChange, JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedNpmPackages: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, workspaceJson, nxJson, packageJson): string[] => {
  const packageJsonChange = touchedFiles.find(f => f.file === 'package.json');
  if (!packageJsonChange) return [];

  let touched = [];
  const changes = packageJsonChange.getChanges();

  for (const c of changes) {
    if (
      isJsonChange(c) &&
      (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') &&
      c.path.length === 2
    ) {
      // A package was deleted so mark all workspace projects as touched.
      if (c.type === DiffType.Deleted) {
        touched = Object.keys(workspaceJson.projects);
        break;
      } else {
        touched.push(c.path[1]);
      }
    } else if (isWholeFileChange(c)) {
      // Whole file was touched, so all npm packages are touched.
      touched = Object.keys({
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
      });
      break;
    }
  }

  return touched;
};
