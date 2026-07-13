import {
  addProjectConfiguration,
  type ProjectGraph,
  type Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { configurationGenerator } from './configuration';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/vitest:configuration', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = { nodes: {}, dependencies: {} };
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'mylib', {
      root: 'libs/mylib',
      projectType: 'library',
      sourceRoot: 'libs/mylib/src',
      targets: {},
    });
    writeJson(tree, 'libs/mylib/tsconfig.json', {});
  });

  function setVitestVersion(version: string): void {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies ??= {};
      json.devDependencies.vitest = version;
      return json;
    });
  }

  it('should inline the projects into a root vitest.config.ts for vitest 4', async () => {
    setVitestVersion('~4.1.0');

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    expect(tree.exists('vitest.workspace.ts')).toBe(false);
    expect(tree.exists('vitest.config.ts')).toBe(true);
    expect(tree.read('vitest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vitest/config';

      export default defineConfig({
        test: {
          projects: ['**/vite.config.{mjs,js,ts,mts}', '**/vitest.config.{mjs,js,ts,mts}', '!vitest.config.ts'],
        },
      });
      "
    `);
  });

  it('should create a root vitest.workspace.ts for vitest 3', async () => {
    setVitestVersion('^3.0.0');

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    expect(tree.exists('vitest.config.ts')).toBe(false);
    expect(tree.read('vitest.workspace.ts', 'utf-8')).toMatchInlineSnapshot(
      `"export default ['**/vite.config.{mjs,js,ts,mts}', '**/vitest.config.{mjs,js,ts,mts}'];"`
    );
  });

  it('should not overwrite an existing root config on repeat generation', async () => {
    setVitestVersion('~4.1.0');
    tree.write('vitest.config.ts', '// user root config');

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    expect(tree.read('vitest.config.ts', 'utf-8')).toBe('// user root config');
  });
});
