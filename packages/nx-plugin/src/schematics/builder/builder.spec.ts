import * as ngSchematics from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('NxPlugin builder', () => {
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

  it('should generate files', async () => {
    const tree = await runSchematic(
      'builder',
      {
        project: projectName,
        name: 'my-builder',
      },
      appTree
    );

    expect(
      tree.exists('libs/my-plugin/src/builders/my-builder/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/builders/my-builder/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/builders/my-builder/builder.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/builders/my-builder/builder.spec.ts')
    ).toBeTruthy();
  });

  it('should update builders.json', async () => {
    const tree = await runSchematic(
      'builder',
      {
        project: projectName,
        name: 'my-builder',
        description: 'my-builder description',
      },
      appTree
    );

    const buildersJson = readJsonInTree(tree, 'libs/my-plugin/builders.json');

    expect(buildersJson.builders['my-builder'].implementation).toEqual(
      './src/builders/my-builder/builder'
    );
    expect(buildersJson.builders['my-builder'].schema).toEqual(
      './src/builders/my-builder/schema.json'
    );
    expect(buildersJson.builders['my-builder'].description).toEqual(
      'my-builder description'
    );
  });

  it('should generate default description', async () => {
    const tree = await runSchematic(
      'builder',
      {
        project: projectName,
        name: 'my-builder',
      },
      appTree
    );

    const buildersJson = readJsonInTree(tree, 'libs/my-plugin/builders.json');

    expect(buildersJson.builders['my-builder'].description).toEqual(
      'my-builder builder'
    );
  });

  it('should generate custom description', async () => {
    const tree = await runSchematic(
      'builder',
      {
        project: projectName,
        name: 'my-builder',
        description: 'my-builder custom description',
      },
      appTree
    );

    const buildersJson = readJsonInTree(tree, 'libs/my-plugin/builders.json');

    expect(buildersJson.builders['my-builder'].description).toEqual(
      'my-builder custom description'
    );
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate unit test files', async () => {
        const tree = await runSchematic(
          'builder',
          {
            project: projectName,
            name: 'my-builder',
            unitTestRunner: 'none',
          },
          appTree
        );

        expect(
          tree.exists('libs/my-plugin/src/builders/my-builder/builder.spec.ts')
        ).toBeFalsy();
      });
    });
  });
});
