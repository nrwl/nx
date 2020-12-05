import * as ngSchematics from '@angular-devkit/schematics';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('NxPlugin executor', () => {
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
      'executor',
      {
        project: projectName,
        name: 'my-executor',
      },
      appTree
    );

    expect(
      tree.exists('libs/my-plugin/src/executors/my-executor/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/executors/my-executor/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/executors/my-executor/executor.ts')
    ).toBeTruthy();
    expect(
      tree.exists('libs/my-plugin/src/executors/my-executor/executor.spec.ts')
    ).toBeTruthy();
  });

  it('should update executors.json', async () => {
    const tree = await runSchematic(
      'executor',
      {
        project: projectName,
        name: 'my-executor',
        description: 'my-executor description',
      },
      appTree
    );

    const executorJson = readJsonInTree(tree, 'libs/my-plugin/executors.json');

    expect(executorJson.executors['my-executor'].implementation).toEqual(
      './src/executors/my-executor/executor'
    );
    expect(executorJson.executors['my-executor'].schema).toEqual(
      './src/executors/my-executor/schema.json'
    );
    expect(executorJson.executors['my-executor'].description).toEqual(
      'my-executor description'
    );
  });

  it('should generate default description', async () => {
    const tree = await runSchematic(
      'executor',
      {
        project: projectName,
        name: 'my-executor',
      },
      appTree
    );

    const executorsJson = readJsonInTree(tree, 'libs/my-plugin/executors.json');

    expect(executorsJson.executors['my-executor'].description).toEqual(
      'my-executor executor'
    );
  });

  it('should generate custom description', async () => {
    const tree = await runSchematic(
      'executor',
      {
        project: projectName,
        name: 'my-executor',
        description: 'my-executor custom description',
      },
      appTree
    );

    const executorsJson = readJsonInTree(tree, 'libs/my-plugin/executors.json');

    expect(executorsJson.executors['my-executor'].description).toEqual(
      'my-executor custom description'
    );
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate unit test files', async () => {
        const tree = await runSchematic(
          'executor',
          {
            project: projectName,
            name: 'my-executor',
            unitTestRunner: 'none',
          },
          appTree
        );

        expect(
          tree.exists(
            'libs/my-plugin/src/executors/my-executor/executor.spec.ts'
          )
        ).toBeFalsy();
      });
    });
  });
});
