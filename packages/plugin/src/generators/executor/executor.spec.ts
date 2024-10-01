import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, readJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { executorGenerator } from './executor';
import { pluginGenerator } from '../plugin/plugin';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { setCwd } from '@nx/devkit/internal-testing-utils';
import { Linter } from '@nx/eslint';

describe('NxPlugin Executor Generator', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-plugin';
    tree = createTreeWithEmptyWorkspace();
    setCwd('');

    await pluginGenerator(tree, {
      directory: projectName,
      unitTestRunner: 'jest',
      linter: Linter.EsLint,
      compiler: 'tsc',
    });
  });

  it('should generate files', async () => {
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'my-plugin/src/executors/my-executor',
      unitTestRunner: 'jest',
      includeHasher: false,
    });

    expect(
      tree.exists('my-plugin/src/executors/my-executor/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/executor.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/executor.spec.ts')
    ).toBeTruthy();
  });

  it('should generate files relative to the cwd', async () => {
    setCwd('my-plugin/src/executors/my-executor');
    await executorGenerator(tree, {
      name: 'my-executor',
      unitTestRunner: 'jest',
      path: 'my-plugin/src/executors/my-executor',
      includeHasher: false,
    });

    expect(
      tree.exists('my-plugin/src/executors/my-executor/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/executor.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/executor.spec.ts')
    ).toBeTruthy();
  });

  it('should update executors.json', async () => {
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'my-plugin/src/executors/my-executor',
      unitTestRunner: 'jest',
      includeHasher: false,
    });

    const executorJson = readJson(tree, 'my-plugin/executors.json');

    expect(executorJson.executors['my-executor'].implementation).toEqual(
      './src/executors/my-executor/executor'
    );
    expect(executorJson.executors['my-executor'].schema).toEqual(
      './src/executors/my-executor/schema.json'
    );
    expect(executorJson.executors['my-executor'].description).toEqual(
      'my-executor executor'
    );
  });

  it('should generate custom description', async () => {
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'my-plugin/src/executors/my-executor',
      description: 'my-executor custom description',
      unitTestRunner: 'jest',
      includeHasher: false,
    });

    const executorsJson = readJson(tree, 'my-plugin/executors.json');

    expect(executorsJson.executors['my-executor'].description).toEqual(
      'my-executor custom description'
    );
  });

  it('should create executors.json if it is not present', async () => {
    await jsLibraryGenerator(tree, {
      directory: 'test-js-lib',
      bundler: 'tsc',
    });
    const libConfig = readProjectConfiguration(tree, 'test-js-lib');

    await executorGenerator(tree, {
      name: 'test-executor',
      path: 'test-js-lib/src/executors/my-executor',
      unitTestRunner: 'jest',
      includeHasher: false,
    });

    expect(() => tree.exists(`${libConfig.root}/executors.json`)).not.toThrow();
    expect(readJson(tree, `${libConfig.root}/package.json`).executors).toBe(
      './executors.json'
    );
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate unit test files', async () => {
        await executorGenerator(tree, {
          name: 'my-executor',
          path: 'my-plugin/src/executors/my-executor',
          unitTestRunner: 'none',
          includeHasher: false,
        });

        expect(
          tree.exists('my-plugin/src/executors/my-executor/executor.spec.ts')
        ).toBeFalsy();
        expect(
          tree.exists('my-plugin/src/executors/my-executor/hasher.spec.ts')
        ).toBeFalsy();
      });
    });
  });

  describe('--includeHasher', () => {
    it('should generate hasher files', async () => {
      await executorGenerator(tree, {
        name: 'my-executor',
        path: 'my-plugin/src/executors/my-executor',
        unitTestRunner: 'jest',
        includeHasher: true,
      });
      expect(
        tree.exists('my-plugin/src/executors/my-executor/hasher.spec.ts')
      ).toBeTruthy();
      expect(
        tree.read('my-plugin/src/executors/my-executor/hasher.ts').toString()
      ).toMatchInlineSnapshot(`
        "import { CustomHasher } from '@nx/devkit';

        /**
         * This is a boilerplate custom hasher that matches
         * the default Nx hasher. If you need to extend the behavior,
         * you can consume workspace details from the context.
         */
        export const myExecutorHasher: CustomHasher = async (task, context) => {
          return context.hasher.hashTask(task, context.taskGraph);
        };

        export default myExecutorHasher;
        "
      `);
    });

    it('should update executors.json', async () => {
      await executorGenerator(tree, {
        name: 'my-executor',
        path: 'my-plugin/src/executors/my-executor',
        unitTestRunner: 'jest',
        includeHasher: true,
      });

      const executorsJson = readJson(tree, 'my-plugin/executors.json');
      expect(executorsJson.executors['my-executor'].hasher).toEqual(
        './src/executors/my-executor/hasher'
      );
    });
  });
});
