import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, readJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { executorGenerator } from './executor';
import { pluginGenerator } from '../plugin/plugin';
import { libraryGenerator as jsLibraryGenerator } from '@nx/js';
import { setCwd } from '@nx/devkit/internal-testing-utils';

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
      linter: 'eslint',
      compiler: 'tsc',
    });
  });

  it('should generate files', async () => {
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'my-plugin/src/executors/my-executor/executor',
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

  it('should handle path with file extension', async () => {
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'my-plugin/src/executors/my-executor/executor.ts',
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
      path: 'my-plugin/src/executors/my-executor/executor',
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
      path: 'my-plugin/src/executors/my-executor/executor',
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
      path: 'my-plugin/src/executors/my-executor/executor',
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
      path: 'test-js-lib/src/executors/my-executor/executor',
      unitTestRunner: 'jest',
      includeHasher: false,
    });

    expect(() => tree.exists(`${libConfig.root}/executors.json`)).not.toThrow();
    expect(readJson(tree, `${libConfig.root}/package.json`).executors).toBe(
      './executors.json'
    );
  });

  it('should support custom executor file name', async () => {
    await executorGenerator(tree, {
      name: 'my-executor',
      path: 'my-plugin/src/executors/my-executor/my-custom-executor',
      unitTestRunner: 'jest',
      includeHasher: true,
    });

    expect(
      tree.exists('my-plugin/src/executors/my-executor/schema.d.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/schema.json')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/my-custom-executor.ts')
    ).toBeTruthy();
    expect(
      tree.exists(
        'my-plugin/src/executors/my-executor/my-custom-executor.spec.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/hasher.ts')
    ).toBeTruthy();
    expect(
      tree.exists('my-plugin/src/executors/my-executor/hasher.spec.ts')
    ).toBeTruthy();
    expect(tree.read('my-plugin/executors.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "executors": {
          "my-executor": {
            "implementation": "./src/executors/my-executor/my-custom-executor",
            "schema": "./src/executors/my-executor/schema.json",
            "description": "my-executor executor",
            "hasher": "./src/executors/my-executor/hasher"
          }
        }
      }
      "
    `);
  });

  describe('--unitTestRunner', () => {
    describe('none', () => {
      it('should not generate unit test files', async () => {
        await executorGenerator(tree, {
          name: 'my-executor',
          path: 'my-plugin/src/executors/my-executor/executor',
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
        path: 'my-plugin/src/executors/my-executor/executor',
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
        path: 'my-plugin/src/executors/my-executor/executor',
        unitTestRunner: 'jest',
        includeHasher: true,
      });

      const executorsJson = readJson(tree, 'my-plugin/executors.json');
      expect(executorsJson.executors['my-executor'].hasher).toEqual(
        './src/executors/my-executor/hasher'
      );
    });
  });

  describe('directory path handling', () => {
    it('should create subdirectory when path looks like a directory', async () => {
      await executorGenerator(tree, {
        name: 'artifact-upload',
        path: 'my-plugin/src/executors/artifact-upload',
        unitTestRunner: 'jest',
        includeHasher: false,
      });

      // Should create files in a subdirectory named after the artifact
      expect(
        tree.exists(
          'my-plugin/src/executors/artifact-upload/artifact-upload.ts'
        )
      ).toBeTruthy();
      expect(
        tree.exists(
          'my-plugin/src/executors/artifact-upload/artifact-upload.spec.ts'
        )
      ).toBeTruthy();
      expect(
        tree.exists('my-plugin/src/executors/artifact-upload/schema.d.ts')
      ).toBeTruthy();
      expect(
        tree.exists('my-plugin/src/executors/artifact-upload/schema.json')
      ).toBeTruthy();

      const executorsJson = readJson(tree, 'my-plugin/executors.json');
      expect(executorsJson.executors['artifact-upload'].implementation).toEqual(
        './src/executors/artifact-upload/artifact-upload'
      );
      expect(executorsJson.executors['artifact-upload'].schema).toEqual(
        './src/executors/artifact-upload/schema.json'
      );
    });

    it('should handle explicit file path correctly', async () => {
      await executorGenerator(tree, {
        name: 'artifact-upload',
        path: 'my-plugin/src/executors/artifact-upload/my-executor',
        unitTestRunner: 'jest',
        includeHasher: false,
      });

      // Should create files with the explicit filename
      expect(
        tree.exists('my-plugin/src/executors/artifact-upload/my-executor.ts')
      ).toBeTruthy();
      expect(
        tree.exists(
          'my-plugin/src/executors/artifact-upload/my-executor.spec.ts'
        )
      ).toBeTruthy();
      expect(
        tree.exists('my-plugin/src/executors/artifact-upload/schema.d.ts')
      ).toBeTruthy();
      expect(
        tree.exists('my-plugin/src/executors/artifact-upload/schema.json')
      ).toBeTruthy();

      const executorsJson = readJson(tree, 'my-plugin/executors.json');
      expect(executorsJson.executors['artifact-upload'].implementation).toEqual(
        './src/executors/artifact-upload/my-executor'
      );
    });
  });
});
