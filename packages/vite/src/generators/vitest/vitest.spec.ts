import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

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
    coverageProvider: 'v8',
    addPlugin: true,
  };

  describe('tsconfig', () => {
    beforeAll(async () => {
      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockReactAppGenerator(appTree);
      await generator(appTree, options);
    });

    it('should add vitest.workspace.ts at the root', async () => {
      expect(appTree.read('vitest.workspace.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should add a tsconfig.spec.json file', async () => {
      const tsconfig = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.json')?.toString() ?? '{}'
      );
      expect(tsconfig.references).toMatchInlineSnapshot(`
        [
          {
            "path": "./tsconfig.app.json",
          },
          {
            "path": "./tsconfig.spec.json",
          },
        ]
      `);

      const tsconfigSpec = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.spec.json')?.toString() ??
          '{}'
      );
      expect(tsconfigSpec).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "outDir": "../../dist/out-tsc",
            "types": [
              "vitest/globals",
              "vitest/importMeta",
              "vite/client",
              "node",
              "vitest",
            ],
          },
          "extends": "./tsconfig.json",
          "include": [
            "vite.config.ts",
            "vitest.config.ts",
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
      mockReactAppGenerator(appTree, 'my-test-react-app-2');
      await generator(appTree, {
        ...options,
        inSourceTests: true,
        project: 'my-test-react-app-2',
      });
      const tsconfig = JSON.parse(
        appTree
          .read('apps/my-test-react-app-2/tsconfig.app.json')
          ?.toString() ?? '{}'
      );
      expect(tsconfig.compilerOptions.types).toMatchInlineSnapshot(`
        [
          "vitest/importMeta",
        ]
      `);
    });
  });

  describe('vite.config', () => {
    beforeAll(async () => {
      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockReactAppGenerator(appTree);
      await generator(appTree, options);
    });
    it('should create correct vite.config.ts file for apps', async () => {
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
    beforeAll(async () => {
      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      mockReactAppGenerator(appTree);
      await generator(appTree, { ...options, inSourceTests: true });
    });
    it('should add the insourceSource option in the vite config', async () => {
      expect(
        appTree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
