import * as ngSchematics from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, readWorkspace } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('NxPlugin migration', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    appTree = createEmptyWorkspace(ngSchematics.Tree.empty());
    appTree = await runSchematic(
      'plugin',
      { name: projectName, importPath: '@proj/my-plugin' },
      appTree
    );
  });

  it('should update the workspace.json file', async () => {
    const tree = await runSchematic(
      'migration',
      {
        project: projectName,
        version: '1.0.0',
      },
      appTree
    );
    const workspace = await readWorkspace(tree);
    const project = workspace.projects['my-plugin'];
    expect(project.root).toEqual('libs/my-plugin');
    expect(project.architect.build.options.assets).toContainEqual({
      input: './libs/my-plugin',
      glob: 'migrations.json',
      output: '.',
    });
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'migration',
      {
        project: projectName,
        name: 'my-migration',
        description: 'my-migration description',
        version: '1.0.0',
      },
      appTree
    );

    const migrationsJson = readJsonInTree(
      tree,
      'libs/my-plugin/migrations.json'
    );
    const packageJson = readJsonInTree(tree, 'libs/my-plugin/package.json');

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

    expect(packageJson['nx-migrate'].migrations).toEqual('./migrations.json');
  });

  it('should generate files with default name', async () => {
    const tree = await runSchematic(
      'migration',
      {
        project: projectName,
        description: 'my-migration description',
        version: '1.0.0',
      },
      appTree
    );

    const migrationsJson = readJsonInTree(
      tree,
      'libs/my-plugin/migrations.json'
    );

    expect(
      tree.exists('libs/my-plugin/src/migrations/update-1.0.0/update-1.0.0.ts')
    ).toBeTruthy();

    expect(migrationsJson.generators['update-1.0.0'].implementation).toEqual(
      './src/migrations/update-1.0.0/update-1.0.0'
    );
  });

  it('should generate files with default description', async () => {
    const tree = await runSchematic(
      'migration',
      {
        project: projectName,
        name: 'my-migration',
        version: '1.0.0',
      },
      appTree
    );

    const migrationsJson = readJsonInTree(
      tree,
      'libs/my-plugin/migrations.json'
    );

    expect(migrationsJson.generators['my-migration'].description).toEqual(
      'my-migration'
    );
  });

  it('should generate files with package.json updates', async () => {
    const tree = await runSchematic(
      'migration',
      {
        project: projectName,
        name: 'my-migration',
        version: '1.0.0',
        packageJsonUpdates: true,
      },
      appTree
    );

    const migrationsJson = readJsonInTree(
      tree,
      'libs/my-plugin/migrations.json'
    );

    expect(migrationsJson.packageJsonUpdates).toEqual({
      ['1.0.0']: {
        version: '1.0.0',
        packages: {},
      },
    });
  });
});
