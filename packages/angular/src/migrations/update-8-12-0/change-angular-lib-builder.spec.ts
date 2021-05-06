import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { join } from 'path';

describe('Update Angular library builder', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/workspace',
      join(__dirname, '../../../migrations.json')
    );
  });

  it('should overwrite the usual builder with @nrwl/angular:package', async () => {
    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          ['buildable-lib']: {
            projectType: 'library',
            architect: {
              build: {
                builder: '@angular-devkit/build-ng-packagr:build',
              },
            },
          },
          ['anotherbuildable-lib']: {
            projectType: 'library',
            architect: {
              build: {
                builder: '@angular-devkit/build-ng-packagr:build',
              },
            },
          },
          ['nonbuildable-lib']: {
            projectType: 'library',
            architect: {},
          },
        },
      })
    );

    await schematicRunner
      .runSchematicAsync('change-angular-lib-builder', {}, tree)
      .toPromise();

    const config = readWorkspace(tree);
    expect(config.projects['buildable-lib'].architect.build.builder).toBe(
      '@nrwl/angular:package'
    );
    expect(
      config.projects['anotherbuildable-lib'].architect.build.builder
    ).toBe('@nrwl/angular:package');
    expect(
      config.projects['nonbuildable-lib'].architect.build
    ).not.toBeDefined();
  });
});
