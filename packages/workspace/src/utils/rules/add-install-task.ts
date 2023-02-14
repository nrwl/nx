import type { Rule } from '@angular-devkit/schematics';

let installAdded = false;
export function addInstallTask(
  options: { skipInstall: boolean } = { skipInstall: false }
): Rule {
  const {
    NodePackageInstallTask,
  } = require('@angular-devkit/schematics/tasks');
  return (_, context) => {
    if (!options.skipInstall && !installAdded) {
      context.addTask(new NodePackageInstallTask());
      installAdded = true;
    }
  };
}
