import { NxJson } from '../../shared-interfaces';
import { FileChange } from '../../file-utils';

export function getTouchedNpmPackages(
  workspaceJson: any,
  nxJson: NxJson,
  touchedFiles: FileChange[]
): string[] {
  const packageJson = touchedFiles.find(f => f.file === 'package.json');
  const touched = [];
  if (packageJson) {
    const changes = packageJson.getChanges();
    changes.forEach(c => {
      if (c.path[0] === 'dependencies' || c.path[0] === 'devDependencies') {
        touched.push(c.path[1]);
      }
    });
  }
  return touched;
}
