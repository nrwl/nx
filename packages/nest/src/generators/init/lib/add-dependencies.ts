import type { GeneratorCallback, Tree } from '@nx/devkit';
import { addDependenciesToPackageJson } from '@nx/devkit';
import { nestJsSchematicsVersion, nxVersion } from '../../../utils/versions';

export function addDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nestjs/schematics': nestJsSchematicsVersion,
      '@nx/nest': nxVersion,
    }
  );
}
