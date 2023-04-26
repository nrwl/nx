import type { Rule } from '@angular-devkit/schematics';

let installAdded = false;

/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nx/devkit. This function can be replaced with 'addDependenciesToPackageJson' from @nx/devkit.
 */
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
