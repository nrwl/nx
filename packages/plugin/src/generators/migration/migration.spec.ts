import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrationGenerator } from './migration';
import { pluginGenerator } from '../plugin/plugin';
import { setCwd } from '@nx/devkit/internal-testing-utils';
import { Linter } from '@nx/eslint';

describe('NxPlugin migration generator', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    tree = createTreeWithEmptyWorkspace();
    setCwd('');

    await pluginGenerator(tree, {
      name: projectName,
      directory: 'packages/my-plugin',
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      compiler: 'tsc',
    });
  });

  it('should update the workspace.json file', async () => {
    await migrationGenerator(tree, {
      path: `packages/my-plugin/${projectName}`,
      packageVersion: '1.0.0',
    });

    const project = readProjectConfiguration(tree, projectName);
    expect(project.root).toEqual('packages/my-plugin');
    expect(project.targets.build.options.assets).toContainEqual({
      input: './packages/my-plugin',
      glob: 'migrations.json',
      output: '.',
    });
  });

  it('should generate files', async () => {
    await migrationGenerator(tree, {
      name: 'my-migration',
      path: 'packages/my-plugin/migrations/1.0.0',
      packageVersion: '1.0.0',
    });

    const migrationsJson = readJson(tree, 'packages/my-plugin/migrations.json');
    const packageJson = readJson(tree, 'packages/my-plugin/package.json');

    expect(
      tree.exists('packages/my-plugin/migrations/1.0.0/my-migration.ts')
    ).toBeTruthy();

    expect(migrationsJson.generators['my-migration'].version).toEqual('1.0.0');
    expect(migrationsJson.generators['my-migration'].description).toEqual(
      'Migration for v1.0.0'
    );
    expect(migrationsJson.generators['my-migration'].implementation).toEqual(
      './migrations/1.0.0/my-migration'
    );
    expect(migrationsJson.packageJsonUpdates).toBeFalsy();

    expect(packageJson['nx-migrations'].migrations).toEqual(
      './migrations.json'
    );
  });

  it('should generate files with default name', async () => {
    await migrationGenerator(tree, {
      description: 'my-migration description',
      path: 'packages/my-plugin/src/migrations/update-1.0.0',
      packageVersion: '1.0.0',
    });

    const migrationsJson = readJson(tree, 'packages/my-plugin/migrations.json');

    expect(
      tree.exists(
        'packages/my-plugin/src/migrations/update-1.0.0/update-1.0.0.ts'
      )
    ).toBeTruthy();

    expect(migrationsJson.generators['update-1.0.0'].implementation).toEqual(
      './src/migrations/update-1.0.0/update-1.0.0'
    );
  });

  it('should generate files with default description', async () => {
    await migrationGenerator(tree, {
      name: 'my-migration',
      path: 'packages/my-plugin/src/migrations/update-1.0.0',
      packageVersion: '1.0.0',
    });

    const migrationsJson = readJson(tree, 'packages/my-plugin/migrations.json');

    expect(migrationsJson.generators['my-migration'].description).toEqual(
      'Migration for v1.0.0'
    );
  });

  it('should generate files with package.json updates', async () => {
    await migrationGenerator(tree, {
      name: 'my-migration',
      path: 'packages/my-plugin/src/migrations/update-1.0.0',
      packageVersion: '1.0.0',
      packageJsonUpdates: true,
    });

    const migrationsJson = readJson(tree, 'packages/my-plugin/migrations.json');

    expect(migrationsJson.packageJsonUpdates).toEqual({
      ['1.0.0']: {
        version: '1.0.0',
        packages: {},
      },
    });
  });
});
