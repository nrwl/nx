import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

import generator from './vitest-generator';
import { VitestGeneratorSchema } from './schema';
import {
  mockReactAppGenerator,
  mockReactLibNonBuildableJestTestRunnerGenerator,
} from '../../utils/test-utils';

describe('vitest generator', () => {
  let appTree: Tree;
  const options: VitestGeneratorSchema = {
    project: 'my-test-react-app',
    uiFramework: 'react',
    coverageProvider: 'c8',
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('Should add the test target to existing test target', async () => {
    mockReactAppGenerator(appTree);
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'my-test-react-app');
    expect(config.targets['test']).toMatchInlineSnapshot(`
      Object {
        "executor": "@nrwl/vite:test",
        "options": Object {
          "passWithNoTests": true,
        },
        "outputs": Array [
          "{workspaceRoot}/coverage/{projectRoot}",
        ],
      }
    `);
  });

  it('should add the test target if its missing', async () => {
    mockReactAppGenerator(appTree);
    const projectConfig = readProjectConfiguration(
      appTree,
      'my-test-react-app'
    );
    delete projectConfig.targets.test;
    updateProjectConfiguration(appTree, 'my-test-react-app', projectConfig);
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'my-test-react-app');
    expect(config.targets['test']).toMatchInlineSnapshot(`
      Object {
        "executor": "@nrwl/vite:test",
        "options": Object {
          "passWithNoTests": true,
          "reportsDirectory": "../../coverage/apps/my-test-react-app",
        },
        "outputs": Array [
          "coverage/apps/my-test-react-app",
        ],
      }
    `);
  });

  describe('tsconfig', () => {
    it('should add a tsconfig.spec.json file', async () => {
      mockReactAppGenerator(appTree);
      await generator(appTree, options);
      const tsconfig = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.json')?.toString() ?? '{}'
      );
      expect(tsconfig.references).toMatchInlineSnapshot(`
              Array [
                Object {
                  "path": "./tsconfig.app.json",
                },
                Object {
                  "path": "./tsconfig.spec.json",
                },
              ]
          `);

      const tsconfigSpec = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.spec.json')?.toString() ??
          '{}'
      );
      expect(tsconfigSpec).toMatchInlineSnapshot(`
        Object {
          "compilerOptions": Object {
            "outDir": "../../dist/out-tsc",
            "types": Array [
              "vitest/globals",
              "vitest/importMeta",
              "vite/client",
              "node",
            ],
          },
          "extends": "./tsconfig.json",
          "include": Array [
            "vite.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts",
          ],
        }
      `);
    });

    it('should add vitest/importMeta when inSourceTests is true', async () => {
      mockReactAppGenerator(appTree);
      await generator(appTree, { ...options, inSourceTests: true });
      const tsconfig = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.app.json')?.toString() ??
          '{}'
      );
      expect(tsconfig.compilerOptions.types).toMatchInlineSnapshot(`
        Array [
          "vitest/importMeta",
        ]
      `);
    });
  });

  describe('vite.config', () => {
    it('should create correct vite.config.ts file for apps', async () => {
      mockReactAppGenerator(appTree);
      await generator(appTree, options);
      expect(
        appTree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should create correct vite.config.ts file for non buildable libs', async () => {
      mockReactLibNonBuildableJestTestRunnerGenerator(appTree);
      await generator(appTree, { ...options, project: 'react-lib-nonb-jest' });
      expect(
        appTree.read('libs/react-lib-nonb-jest/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('insourceTests', () => {
    it('should add the insourceSource option in the vite config', async () => {
      mockReactAppGenerator(appTree);
      await generator(appTree, { ...options, inSourceTests: true });
      expect(
        appTree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
