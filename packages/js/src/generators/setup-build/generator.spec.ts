import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';

import { setupBuildGenerator } from './generator';

describe('setup-build generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'mypkg', {
      root: 'packages/mypkg',
      sourceRoot: 'packages/mypkg/src',
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

  it('should error when eithe main or tsConfig is not found', async () => {
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

    expect(tree.exists('packages/mypkg/rollup.config.js')).toBe(true);
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

  // TODO(@jaysoo): For some reason, there is no vite.config file here. Please re-enable this test
  xit('should support --bundler=vite', async () => {
    tree.write('packages/mypkg/src/main.ts', 'console.log("hello world");');
    writeJson(tree, 'packages/mypkg/tsconfig.lib.json', {});

    await setupBuildGenerator(tree, {
      project: 'mypkg',
      bundler: 'vite',
    });

    expect(tree.exists('packages/mypkg/vite.config.ts')).toBe(true);
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
