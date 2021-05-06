import { Rule } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

let installAdded = false;
export function addInstallTask(
  options: { skipInstall: boolean } = { skipInstall: false }
): Rule {
  return (_, context) => {
    if (!options.skipInstall && !installAdded) {
      context.addTask(new NodePackageInstallTask());
      installAdded = true;
    }
  };
}
