import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson, runTasksInSerial } from '@nx/devkit';
import { ensureTypescriptForNestSchematics } from '../../../utils/ensure-typescript-for-schematics';
import { nxVersion, versions } from '../../../utils/versions';
import { InitGeneratorOptions } from '../schema';

export function addDependencies(
  tree: Tree,
  options: InitGeneratorOptions
): GeneratorCallback {
  return runTasksInSerial(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nestjs/schematics': versions(tree).nestJsSchematicsVersion,
        '@nx/nest': nxVersion,
      },
      undefined,
      options.keepExistingVersions ?? true
    ),
    ensureTypescriptForNestSchematics(tree)
  );
}
