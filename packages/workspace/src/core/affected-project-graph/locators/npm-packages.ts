import { isWholeFileChange, WholeFileChange } from '../../file-utils';
import { isJsonChange, JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';

export const getTouchedNpmPackages: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (touchedFiles, workspaceJson, nxJson, packageJson): string[] => {
  const packageJsonChange = touchedFiles.find(f => f.file === 'package.json');
  const touched = [];
  if (packageJsonChange) {
    const changes = packageJsonChange.getChanges();
    changes.forEach(c => {
      if (
        isJsonChange(c) &&
        (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') &&
        c.value.rhs // If rhs is blank then dep was deleted and does not exist in project graph
      ) {
        touched.push(c.path[1]);
      } else if (isWholeFileChange(c)) {
        Object.keys({
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        }).forEach(p => {
          touched.push(p);
        });
      }
    });
  }
  return touched;
};
