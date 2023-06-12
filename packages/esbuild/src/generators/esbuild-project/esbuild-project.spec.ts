import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import esbuildProjectGenerator from './esbuild-project';

describe('esbuildProjectGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it.each`
    tsConfig               | main
    ${'tsconfig.app.json'} | ${'main.ts'}
    ${'tsconfig.lib.json'} | ${'index.ts'}
  `('should detect main and tsconfig paths', async ({ tsConfig, main }) => {
    addProjectConfiguration(tree, 'mypkg', {
      root: 'mypkg',
    });
    tree.write(`mypkg/src/${main}`, 'console.log("main");');
    writeJson(tree, `mypkg/${tsConfig}`, {});

    await esbuildProjectGenerator(tree, {
      project: 'mypkg',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets.build.options).toEqual({
      assets: [],
      main: `mypkg/src/${main}`,
      outputFileName: 'main.js',
      outputPath: 'dist/mypkg',
      tsConfig: `mypkg/${tsConfig}`,
    });
  });

  it('should work for root projects', async () => {
    addProjectConfiguration(tree, 'mypkg', {
      root: '.',
    });
    tree.write(`src/main.ts`, 'console.log("main");');
    writeJson(tree, `tsconfig.app.json`, {});

    await esbuildProjectGenerator(tree, {
      project: 'mypkg',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets.build.options).toEqual({
      assets: [],
      main: `src/main.ts`,
      outputFileName: 'main.js',
      outputPath: 'dist/mypkg',
      tsConfig: `tsconfig.app.json`,
    });
  });
});
