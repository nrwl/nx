import {
  addProjectConfiguration,
  logger,
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
          projects: ['**/vite.config.{mjs,js,ts,mts}', '**/vitest.config.{mjs,js,ts,mts}', '!vitest.config.{mjs,js,ts,mts}', '!vite.config.{mjs,js,ts,mts}'],
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

  it('should warn without overwriting when a root vitest.config.ts does not aggregate projects', async () => {
    setVitestVersion('~4.1.0');
    const rootConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true },
});
`;
    tree.write('vitest.config.ts', rootConfig);
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    expect(tree.read('vitest.config.ts', 'utf-8')).toBe(rootConfig);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('test.projects')
    );

    warnSpy.mockRestore();
  });

  it('should warn when a root vitest.config.ts shape cannot be analyzed', async () => {
    setVitestVersion('~4.1.0');
    const rootConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({ test: { globals: true } }));
`;
    tree.write('vitest.config.ts', rootConfig);
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    // A function config can't be read statically, so we can't confirm it
    // aggregates; warn instead of leaving the project silently undiscovered.
    expect(tree.read('vitest.config.ts', 'utf-8')).toBe(rootConfig);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("test setup couldn't be")
    );

    warnSpy.mockRestore();
  });

  it('should not overwrite a root vitest.config.ts that already aggregates projects', async () => {
    setVitestVersion('~4.1.0');
    const rootConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { projects: ['packages/*'] },
});
`;
    tree.write('vitest.config.ts', rootConfig);
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    // The root vitest.config.ts already aggregates via test.projects; leave it
    // untouched and don't warn.
    expect(tree.read('vitest.config.ts', 'utf-8')).toBe(rootConfig);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('test.projects')
    );

    warnSpy.mockRestore();
  });

  it('should skip and warn when a plain root vite.config.ts exists', async () => {
    setVitestVersion('~4.1.0');
    const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
});
`;
    tree.write('vite.config.ts', viteConfig);
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    // A generated vitest.config.ts would win resolution and shadow the root vite
    // config, dropping its settings (aliases, plugins) from vitest runs. Leave
    // it in place and warn that the project's own config won't apply.
    expect(tree.exists('vitest.config.ts')).toBe(false);
    expect(tree.read('vite.config.ts', 'utf-8')).toBe(viteConfig);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('setupFiles'));

    warnSpy.mockRestore();
  });

  it('should not create a root vitest.config.ts when the root vite.config.ts already aggregates projects', async () => {
    setVitestVersion('~4.1.0');
    const viteConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { projects: ['packages/*'] },
});
`;
    tree.write('vite.config.ts', viteConfig);
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    // The vite config already aggregates via test.projects; a generated
    // vitest.config.ts would shadow it, so nothing is written and no vite-config
    // warning is emitted.
    expect(tree.exists('vitest.config.ts')).toBe(false);
    expect(tree.read('vite.config.ts', 'utf-8')).toBe(viteConfig);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('test.projects')
    );

    warnSpy.mockRestore();
  });

  it('should not create a competing aggregator when the root vite.config.ts is a function config', async () => {
    setVitestVersion('~4.1.0');
    tree.write(
      'vite.config.ts',
      `import { defineConfig } from 'vite';

export default defineConfig(() => ({ plugins: [] }));
`
    );
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await configurationGenerator(tree, {
      project: 'mylib',
      uiFramework: 'none',
      coverageProvider: 'v8',
      skipViteConfig: true,
      skipPackageJson: true,
      addPlugin: false,
      skipFormat: true,
    });

    // A function config can't be read statically, so we can't rule out that it
    // aggregates; stay conservative and warn instead of shadowing it.
    expect(tree.exists('vitest.config.ts')).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('test.projects')
    );

    warnSpy.mockRestore();
  });

  it('should not create a root vitest.config.ts when a root vitest.workspace.ts already exists', async () => {
    setVitestVersion('~4.1.0');
    tree.write('vitest.workspace.ts', '// existing workspace file');

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
    expect(tree.read('vitest.workspace.ts', 'utf-8')).toBe(
      '// existing workspace file'
    );
  });

  it('should default to the root vitest.config.ts shape when the vitest version cannot be detected', async () => {
    // No vitest in package.json, so the version is undetectable; new installs
    // resolve to vitest 4, so the root config uses the inlined projects shape.
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
  });
});
