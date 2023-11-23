import {
  addProjectConfiguration,
  readProjectConfiguration,
  updateJson,
  writeJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { setupBuildGenerator } from './generator';

describe('setup-build generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'mypkg', {
      root: 'packages/mypkg',
      sourceRoot: 'packages/mypkg/src',
    });
    updateJson(tree, 'tsconfig.base.json', (json) => {
      json.compilerOptions ??= {};
      json.compilerOptions.paths ??= {};
      json.compilerOptions.paths['@proj/mypkg'] = [
        'packages/mypkg/src/index.ts',
      ];
      return json;
    });
  });

  it('should find main and tsConfig files automatically', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, { project: 'mypkg', bundler: 'tsc' });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/index.ts',
            tsConfig: 'packages/mypkg/tsconfig.lib.json',
          },
        },
      },
    });
  });

  it('should support user-defined main and tsConfig files', async () => {
    tree.write(
      'packages/mypkg/src/custom-main.ts',
      'console.log("hello world");'
    );
    writeJson(tree, 'packages/mypkg/tsconfig.custom.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      main: 'packages/mypkg/src/custom-main.ts',
      tsConfig: 'packages/mypkg/tsconfig.custom.json',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/custom-main.ts',
            tsConfig: 'packages/mypkg/tsconfig.custom.json',
          },
        },
      },
    });
  });

  it('should not add build target when "@nx/js/plugin" is configured and "publishable"', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/js/plugin');
      return json;
    });

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      publishable: true,
      importPath: '@proj/mypkg',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config.targets).toBeUndefined();
  });

  it('should add build target only with custom options when "@nx/js/plugin" is configured', async () => {
    tree.write(
      'packages/mypkg/src/custom-main.ts',
      'console.log("hello world");'
    );
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/js/plugin');
      return json;
    });

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      publishable: true,
      importPath: '@proj/mypkg',
      main: 'packages/mypkg/src/custom-main.ts',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config.targets).toMatchObject({
      build: {
        options: {
          main: 'packages/mypkg/src/custom-main.ts',
        },
      },
    });
  });

  it('should add complete build target when custom build target name does not match the one configured for the "@nx/js/plugin"', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push({
        plugin: '@nx/js/plugin',
        options: { buildTargetName: 'build' },
      });
      return json;
    });

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      publishable: true,
      importPath: '@proj/mypkg',
      buildTarget: 'custom-build',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        'custom-build': {
          executor: '@nx/js:tsc',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/index.ts',
            tsConfig: 'packages/mypkg/tsconfig.lib.json',
            assets: [],
          },
        },
      },
    });
  });

  it('should add full build target when "@nx/js/plugin" is configured and not "publishable"', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/js/plugin');
      return json;
    });

    await setupBuildGenerator(tree, { project: 'mypkg', bundler: 'tsc' });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/index.ts',
            tsConfig: 'packages/mypkg/tsconfig.lib.json',
          },
        },
      },
    });
  });

  it('should generate a "package.json" when it does not exist', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, { project: 'mypkg', bundler: 'tsc' });

    expect(tree.exists('packages/mypkg/package.json')).toBe(true);
    expect(tree.read('packages/mypkg/package.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "name": "@proj/mypkg",
        "version": "0.0.1",
        "private": true,
        "dependencies": {
          "tslib": "^2.3.0"
        },
        "type": "commonjs",
        "main": "./src/index.js",
        "typings": "./src/index.d.ts"
      }
      "
    `);
  });

  it('should generate a "package.json" without "private: true" when "--publishable"', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      publishable: true,
      importPath: '@proj/mypkg',
    });

    expect(tree.exists('packages/mypkg/package.json')).toBe(true);
    expect(tree.read('packages/mypkg/package.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "name": "@proj/mypkg",
        "version": "0.0.1",
        "dependencies": {
          "tslib": "^2.3.0"
        },
        "type": "commonjs",
        "main": "./src/index.js",
        "typings": "./src/index.d.ts"
      }
      "
    `);
  });

  it('should support user-defined "importPath"', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});
    updateJson(tree, 'tsconfig.base.json', (json) => {
      json.compilerOptions.paths['@proj/my-custom-alias'] =
        json.compilerOptions.paths['@proj/mypkg'];
      delete json.compilerOptions.paths['@proj/mypkg'];
      return json;
    });

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      importPath: '@proj/my-custom-alias',
    });

    expect(tree.exists('packages/mypkg/package.json')).toBe(true);
    expect(tree.read('packages/mypkg/package.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "name": "@proj/my-custom-alias",
        "version": "0.0.1",
        "private": true,
        "dependencies": {
          "tslib": "^2.3.0"
        },
        "type": "commonjs",
        "main": "./src/index.js",
        "typings": "./src/index.d.ts"
      }
      "
    `);
  });

  it('should update existing "package.json"', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});
    writeJson(tree, 'packages/mypkg/package.json', {
      name: '@proj/mypkg',
      version: '0.0.1',
    });

    await setupBuildGenerator(tree, { project: 'mypkg', bundler: 'tsc' });

    expect(tree.exists('packages/mypkg/package.json')).toBe(true);
    expect(tree.read('packages/mypkg/package.json', 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "name": "@proj/mypkg",
        "version": "0.0.1",
        "dependencies": {
          "tslib": "^2.3.0"
        },
        "type": "commonjs",
        "main": "./src/index.js",
        "typings": "./src/index.d.ts"
      }
      "
    `);
  });

  it('should error when "--publishable" and not "importPath" is provided', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await expect(
      setupBuildGenerator(tree, {
        project: 'mypkg',
        bundler: 'tsc',
        publishable: true,
      })
    ).rejects.toThrow(
      /To set up a publishable library, you must provide the "--importPath" option/
    );
  });

  it('should error when provided "importPath" does not exist', async () => {
    tree.write('packages/mypkg/src/index.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await expect(
      setupBuildGenerator(tree, {
        project: 'mypkg',
        bundler: 'tsc',
        importPath: 'my-lib',
      })
    ).rejects.toThrow(
      /The provided import path "my-lib" does not exist in the root tsconfig/
    );
  });

  it('should error when either main or tsConfig is not found', async () => {
    expect(
      setupBuildGenerator(tree, {
        project: 'mypkg',
        bundler: 'tsc',
      })
    ).rejects.toThrow(/Cannot locate a main file for mypkg/);

    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');

    expect(
      setupBuildGenerator(tree, {
        project: 'mypkg',
        bundler: 'tsc',
      })
    ).rejects.toThrow(/Cannot locate a tsConfig file for mypkg/);

    expect(
      setupBuildGenerator(tree, {
        project: 'mypkg',
        bundler: 'tsc',
        main: 'packages/mypkg/src/custom-main.ts',
      })
    ).rejects.toThrow(/Cannot locate a main file for mypkg/);

    expect(
      setupBuildGenerator(tree, {
        project: 'mypkg',
        bundler: 'tsc',
        tsConfig: 'packages/mypkg/tsconfig.custom.json',
      })
    ).rejects.toThrow(/Cannot locate a tsConfig file for mypkg/);
  });

  it('should support --bundler=swc', async () => {
    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'swc',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/js:swc',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/main.ts',
            tsConfig: 'packages/mypkg/tsconfig.lib.json',
          },
        },
      },
    });
  });

  it('should support --bundler=rollup', async () => {
    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'rollup',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/rollup:rollup',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/main.ts',
            tsConfig: 'packages/mypkg/tsconfig.lib.json',
          },
        },
      },
    });
  });

  it('should support --bundler=esbuild', async () => {
    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'esbuild',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: {
            outputPath: 'dist/packages/mypkg',
            main: 'packages/mypkg/src/main.ts',
            tsConfig: 'packages/mypkg/tsconfig.lib.json',
          },
        },
      },
    });
  });

  it('should support --bundler=vite', async () => {
    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'vite',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        build: {
          executor: '@nx/vite:build',
          options: {
            outputPath: 'dist/packages/mypkg',
          },
        },
      },
    });
  });

  it('should support different --buildTarget', async () => {
    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'tsc',
      buildTarget: 'custom-build',
    });

    const config = readProjectConfiguration(tree, 'mypkg');
    expect(config).toMatchObject({
      targets: {
        'custom-build': {
          executor: '@nx/js:tsc',
          options: {
            outputPath: 'dist/packages/mypkg',
          },
        },
      },
    });
  });
});
