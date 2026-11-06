import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
} from '@nx/devkit';
import { isTypescriptVersionAtLeast, typescriptVersion } from '@nx/js/internal';
import { coerce } from 'semver';

/**
 * `@nestjs/schematics` 12 peers `typescript >=6.0.0`, and npm refuses to
 * install it next to TypeScript 5, so the declared `typescript` is upgraded.
 */
export function ensureTypescriptForNestSchematics(
  tree: Tree
): GeneratorCallback {
  const schematics = getDependencyVersionFromPackageJson(
    tree,
    '@nestjs/schematics'
  );
  const schematicsMajor = schematics ? coerce(schematics)?.major : undefined;
  if (
    schematicsMajor === undefined ||
    schematicsMajor < 12 ||
    isTypescriptVersionAtLeast(tree, '6.0.0')
  ) {
    return () => {};
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { typescript: typescriptVersion },
    undefined,
    false
  );
}
