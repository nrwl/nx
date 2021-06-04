import { Tree, readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { executorGenerator } from './executor';
import { pluginGenerator } from '../plugin/plugin';

describe('NxPlugin Executor Generator', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    tree = createTreeWithEmptyWorkspace();

    await pluginGenerator(tree, {
      name: projectName,
    } as any);
  });

  it('should generate files', async () => {
    await executorGenerator(tree, {
      project: projectName,
      name: 'my-executor',
      unitTestRunner: 'jest',
    });

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
    await executorGenerator(tree, {
      project: projectName,
      name: 'my-executor',
      description: 'my-executor description',
      unitTestRunner: 'jest',
    });

    const executorJson = readJson(tree, 'libs/my-plugin/executors.json');

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
    await executorGenerator(tree, {
      project: projectName,
      name: 'my-executor',
      unitTestRunner: 'jest',
    });

    const executorsJson = readJson(tree, 'libs/my-plugin/executors.json');

    expect(executorsJson.executors['my-executor'].description).toEqual(
      'my-executor executor'
    );
  });

  it('should generate custom description', async () => {
    await executorGenerator(tree, {
      project: projectName,
      name: 'my-executor',
      description: 'my-executor custom description',
      unitTestRunner: 'jest',
    });

    const executorsJson = readJson(tree, 'libs/my-plugin/executors.json');

    expect(executorsJson.executors['my-executor'].description).toEqual(
      'my-executor custom description'
    );
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate unit test files', async () => {
        await executorGenerator(tree, {
          project: projectName,
          name: 'my-executor',
          description: 'my-executor description',
          unitTestRunner: 'none',
        });

        expect(
          tree.exists(
            'libs/my-plugin/src/executors/my-executor/executor.spec.ts'
          )
        ).toBeFalsy();
      });
    });
  });
});
