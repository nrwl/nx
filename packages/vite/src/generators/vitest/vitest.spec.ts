import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  createProjectGraphAsync,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import {
  mockAngularAppGenerator,
  mockReactAppGenerator,
  mockReactLibNonBuildableJestTestRunnerGenerator,
} from '../../utils/test-utils';
import { VitestGeneratorSchema } from './schema';
import generator from './vitest-generator';

describe('vitest generator', () => {
  let appTree: Tree;
  const options: VitestGeneratorSchema = {
    project: 'my-test-react-app',
    coverageProvider: 'v8',
    addPlugin: true,
  };

  describe('test target', () => {
    it('should fail if test target is already defined', async () => {
      const { runGenerator } = setUpAngularWorkspace();

      await expect(
        runGenerator({
          addPlugin: false,
        })
      ).rejects.toThrow('Target "test" already exists in the project.');
    });

    it('should not add test target to the project', async () => {
      const { runGenerator, tree } = setUpAngularWorkspace();

      updateJson(tree, 'apps/my-test-angular-app/project.json', (json) => {
        delete json.targets.test;
        return json;
      });

      await runGenerator();

      expect(
        readJson(tree, 'apps/my-test-angular-app/project.json').targets.test
      ).toBeUndefined();
    });

    it('should add test target to the project if plugin is not used', async () => {
      const { runGenerator, tree } = setUpAngularWorkspace();

      updateJson(tree, 'apps/my-test-angular-app/project.json', (json) => {
        delete json.targets.test;
        return json;
      });

      await runGenerator({
        addPlugin: false,
      });

      expect(
        readJson(tree, 'apps/my-test-angular-app/project.json').targets.test
          .executor
      ).toBe('@nx/vite:test');
    });
  });

  describe('tsconfig', () => {
    beforeAll(async () => {
      const { runGenerator, tree } = setUpReactWorkspace();
      appTree = tree;
      await runGenerator();
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
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
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
  });

  describe('vite.config', () => {
    beforeAll(async () => {
      const { runGenerator, tree } = setUpReactWorkspace();
      appTree = tree;
      await runGenerator();
    });

    it('should add @nx/vite dependency', async () => {
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['@nx/vite']).toBeDefined();
    });

    it('should create correct vite.config.ts file for apps', async () => {
      expect(
        appTree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('vite.config for libs', () => {
    it('should create correct vite.config.ts file for non buildable libs', async () => {
      const { runGenerator, tree } = setUpReactWorkspace();

      mockReactLibNonBuildableJestTestRunnerGenerator(tree);
      setProjectGraphDependencies('react-lib-nonb-jest', ['npm:react']);

      await runGenerator({ project: 'react-lib-nonb-jest' });

      expect(
        tree.read('libs/react-lib-nonb-jest/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('insourceTests', () => {
    it('should add the insourceSource option in the vite config', async () => {
      const { runGenerator, tree } = setUpReactWorkspace();

      await runGenerator({ inSourceTests: true });

      expect(
        tree.read('apps/my-test-react-app/vite.config.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add vitest/importMeta when inSourceTests is true', async () => {
      const { tree, runGenerator } = setUpReactWorkspace();

      await runGenerator({ inSourceTests: true });

      const tsconfig = JSON.parse(
        tree.read('apps/my-test-react-app/tsconfig.app.json')?.toString() ??
          '{}'
      );
      expect(tsconfig.compilerOptions.types).toMatchInlineSnapshot(`
        [
          "vitest/importMeta",
        ]
      `);
    });
  });

  describe('angular', () => {
    beforeAll(async () => {
      const { tree, runGenerator } = setUpAngularWorkspace();
      appTree = tree;
      await runGenerator();
    });

    it('should generate vite.config.mts', async () => {
      expect(
        appTree.read('apps/my-test-angular-app/vite.config.mts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not generate vite.config.ts', async () => {
      expect(appTree.exists('apps/my-test-angular-app/vite.config.ts')).toBe(
        false
      );
    });

    it('should generate src/test-setup.ts', async () => {
      expect(
        appTree.read('apps/my-test-angular-app/src/test-setup.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should exclude src/test-setup.ts in tsconfig.app.json', async () => {
      const tsConfig = readJson(
        appTree,
        'apps/my-test-angular-app/tsconfig.app.json'
      );
      expect(tsConfig.exclude).toContain('src/test-setup.ts');
    });

    it('should include src/test-setup.ts in tsconfig.spec.json', async () => {
      const tsConfig = readJson(
        appTree,
        'apps/my-test-angular-app/tsconfig.spec.json'
      );
      expect(tsConfig.files).toContain('src/test-setup.ts');
    });

    it('should add vitest-angular', async () => {
      const { devDependencies } = readJson(appTree, 'package.json');
      expect(devDependencies['@analogjs/vite-plugin-angular']).toBeDefined();
      expect(devDependencies['@analogjs/vitest-angular']).toBeDefined();
    });
  });
});

function setUpAngularWorkspace() {
  const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  const project = 'my-test-angular-app';

  (
    createProjectGraphAsync as jest.MockedFn<typeof createProjectGraphAsync>
  ).mockResolvedValue({
    dependencies: {
      [project]: [
        {
          type: 'static',
          source: project,
          target: 'npm:@angular/core',
        },
      ],
    },
    nodes: {},
  });

  mockAngularAppGenerator(tree);

  return {
    async runGenerator({ addPlugin = true }: { addPlugin?: boolean } = {}) {
      await generator(tree, {
        project,
        coverageProvider: 'v8',
        addPlugin,
      });
      return tree;
    },
    tree,
  };
}

function setUpReactWorkspace() {
  const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  const appName = 'my-test-react-app';

  mockReactAppGenerator(tree);

  setProjectGraphDependencies(appName, ['npm:react']);

  return {
    project: appName,
    async runGenerator({
      addPlugin = true,
      inSourceTests,
      project,
    }: {
      addPlugin?: boolean;
      inSourceTests?: boolean;
      project?: string;
    } = {}) {
      await generator(tree, {
        project: project ?? appName,
        coverageProvider: 'v8',
        addPlugin,
        inSourceTests,
      });
      return tree;
    },
    tree,
  };
}

function setProjectGraphDependencies(project: string, dependencies: string[]) {
  (
    createProjectGraphAsync as jest.MockedFn<typeof createProjectGraphAsync>
  ).mockResolvedValue({
    dependencies: {
      [project]: dependencies.map((target) => ({
        type: 'static',
        source: project,
        target,
      })),
    },
    nodes: {},
  });
}
