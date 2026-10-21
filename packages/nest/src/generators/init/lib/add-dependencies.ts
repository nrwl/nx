import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  getDependencyVersionFromPackageJson,
  runTasksInSerial,
} from '@nx/devkit';
import { isTypescriptVersionAtLeast, typescriptVersion } from '@nx/js/internal';
import { coerce } from 'semver';
import { nxVersion, versions } from '../../../utils/versions';
import { InitGeneratorOptions } from '../schema';

export function addDependencies(
  tree: Tree,
  options: InitGeneratorOptions
): GeneratorCallback {
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nestjs/schematics': versions(tree).nestJsSchematicsVersion,
      '@nx/nest': nxVersion,
    },
    undefined,
    options.keepExistingVersions ?? true
  );

  if (!requiresTypescript6(tree)) {
    return installTask;
  }

  // npm refuses to install @nestjs/schematics 12 next to TypeScript 5
  return runTasksInSerial(
    installTask,
    addDependenciesToPackageJson(
      tree,
      {},
      { typescript: typescriptVersion },
      undefined,
      false
    )
  );
}

function requiresTypescript6(tree: Tree): boolean {
  const schematics = getDependencyVersionFromPackageJson(
    tree,
    '@nestjs/schematics'
  );
  const schematicsMajor = schematics ? coerce(schematics)?.major : undefined;
  return (
    schematicsMajor !== undefined &&
    schematicsMajor >= 12 &&
    !isTypescriptVersionAtLeast(tree, '6.0.0')
  );
}
