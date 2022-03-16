import { Tree, readProjectConfiguration, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { migrationGenerator } from './migration';
import { pluginGenerator } from '../plugin/plugin';

describe('NxPlugin migration generator', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    tree = createTreeWithEmptyWorkspace(2);

    await pluginGenerator(tree, {
      name: projectName,
    } as any);
  });

  it('should update the workspace.json file', async () => {
    await migrationGenerator(tree, {
      project: projectName,
      packageVersion: '1.0.0',
    });

    const project = readProjectConfiguration(tree, projectName);
    expect(project.root).toEqual('libs/my-plugin');
    expect(project.targets.build.options.assets).toContainEqual({
      input: './libs/my-plugin',
      glob: 'migrations.json',
      output: '.',
    });
  });

  it('should generate files', async () => {
    await migrationGenerator(tree, {
      project: projectName,
      name: 'my-migration',
      description: 'my-migration description',
      packageVersion: '1.0.0',
    });

    const migrationsJson = readJson(tree, 'libs/my-plugin/migrations.json');
    const packageJson = readJson(tree, 'libs/my-plugin/package.json');

    expect(
      tree.exists('libs/my-plugin/src/migrations/my-migration/my-migration.ts')
    ).toBeTruthy();

    expect(migrationsJson.generators['my-migration'].version).toEqual('1.0.0');
    expect(migrationsJson.generators['my-migration'].description).toEqual(
      'my-migration description'
    );
    expect(migrationsJson.generators['my-migration'].implementation).toEqual(
      './src/migrations/my-migration/my-migration'
    );
    expect(migrationsJson.packageJsonUpdates).toBeFalsy();

    expect(packageJson['nx-migrations'].migrations).toEqual(
      './migrations.json'
    );
  });

  it('should generate files with default name', async () => {
    await migrationGenerator(tree, {
      project: projectName,
      description: 'my-migration description',
      packageVersion: '1.0.0',
    });

    const migrationsJson = readJson(tree, 'libs/my-plugin/migrations.json');

    expect(
      tree.exists('libs/my-plugin/src/migrations/update-1.0.0/update-1.0.0.ts')
    ).toBeTruthy();

    expect(migrationsJson.generators['update-1.0.0'].implementation).toEqual(
      './src/migrations/update-1.0.0/update-1.0.0'
    );
  });

  it('should generate files with default description', async () => {
    await migrationGenerator(tree, {
      project: projectName,
      name: 'my-migration',
      packageVersion: '1.0.0',
    });

    const migrationsJson = readJson(tree, 'libs/my-plugin/migrations.json');

    expect(migrationsJson.generators['my-migration'].description).toEqual(
      'my-migration'
    );
  });

  it('should generate files with package.json updates', async () => {
    await migrationGenerator(tree, {
      project: projectName,
      name: 'my-migration',
      packageVersion: '1.0.0',
      packageJsonUpdates: true,
    });

    const migrationsJson = readJson(tree, 'libs/my-plugin/migrations.json');

    expect(migrationsJson.packageJsonUpdates).toEqual({
      ['1.0.0']: {
        version: '1.0.0',
        packages: {},
      },
    });
  });
});
