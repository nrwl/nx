import type { Tree } from '@nrwl/devkit';
import {
  addProjectConfiguration,
  readProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import esbuildProjectGenerator from './esbuild-project';

describe('esbuildProjectGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'mypkg', {
      root: 'libs/mypkg',
    });
  });

  it.each`
    tsConfig               | main
    ${'tsconfig.app.json'} | ${'main.ts'}
    ${'tsconfig.lib.json'} | ${'index.ts'}
  `('should detect main and tsconfig paths', async ({ tsConfig, main }) => {
    tree.write(`libs/mypkg/src/${main}`, 'console.log("main");');
    writeJson(tree, `libs/mypkg/${tsConfig}`, {});

    await esbuildProjectGenerator(tree, {
      project: 'mypkg',
    });

    const project = readProjectConfiguration(tree, 'mypkg');

    expect(project.targets.build.options).toEqual({
      assets: [],
      main: `libs/mypkg/src/${main}`,
      outputFileName: 'main.js',
      outputPath: 'dist/libs/mypkg',
      tsConfig: `libs/mypkg/${tsConfig}`,
    });
  });
});
