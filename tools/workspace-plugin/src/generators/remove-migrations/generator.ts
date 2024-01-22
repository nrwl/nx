import {
  formatFiles,
  readJson,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { basename, dirname, join } from 'path';
import { lte, major } from 'semver';

export interface RemoveMigrationsGeneratorSchema {
  v: number;
}

export async function removeMigrationsGenerator(
  tree: Tree,
  { v }: RemoveMigrationsGeneratorSchema
) {
  visitNotIgnoredFiles(tree, '', (path) => {
    // Ignore angular migrations because angular needs to support migrations until LTS support is dropped
    if (['packages/angular/package.json'].includes(path)) {
      return;
    }

    if (basename(path) !== 'package.json') {
      return;
    }

    const packageJson = readJson(tree, path);

    const migrations =
      packageJson?.['nx-migrations']?.migrations ??
      packageJson?.['ng-update']?.migrations;
    if (!migrations) {
      return;
    }

    if (migrations.startsWith('.')) {
      const migrationsPath = join(dirname(path), migrations);

      updateJson(tree, migrationsPath, (migrationsJson) => {
        const { generators, packageJsonUpdates } = migrationsJson;
        for (const [migrationName, m] of Object.entries(generators)) {
          if (major(m.version) < v) {
            const implFile = getImplFile(tree, migrationsPath, m);

            const specFile = implFile.replace('.ts', '.spec.ts');
            const snapshotsPath = join(dirname(specFile), '__snapshots__');
            try {
              tree.delete(implFile);
              tree.delete(specFile);
              tree.delete(snapshotsPath);
            } catch (e) {
              console.log(e);
            }

            delete migrationsJson.generators[migrationName];
          }
        }

        for (const [updateName, packageJsonUpdate] of Object.entries(
          packageJsonUpdates ?? {}
        )) {
          if (major(packageJsonUpdate.version) < v) {
            delete packageJsonUpdates[updateName];
          }
        }

        return migrationsJson;
      });
    }
  });
  await formatFiles(tree);
}

export default removeMigrationsGenerator;

function getImplFile(
  tree: Tree,
  migrationsFilePath: string,
  {
    implementation,
    factory,
  }: {
    implementation?: string;
    factory?: string;
  }
) {
  const rawPath = implementation ?? factory;

  const fullPath = join(dirname(migrationsFilePath), rawPath);

  if (tree.exists(fullPath)) {
    return fullPath;
  }
  if (tree.exists(fullPath + '.ts')) {
    return fullPath + '.ts';
  }

  return fullPath;
}
