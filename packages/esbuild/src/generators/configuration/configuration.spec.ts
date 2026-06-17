import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import configurationGenerator from './configuration';

describe('configurationGenerator', () => {
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

    await configurationGenerator(tree, {
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

    await configurationGenerator(tree, {
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

  it('should set @nx/esbuild:esbuild target defaults with the tsconfig field-scoped input', async () => {
    addProjectConfiguration(tree, 'mypkg', {
      root: 'mypkg',
    });
    tree.write('mypkg/src/main.ts', 'console.log("main");');
    writeJson(tree, 'mypkg/tsconfig.app.json', {});

    await configurationGenerator(tree, {
      project: 'mypkg',
    });

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.targetDefaults['@nx/esbuild:esbuild']).toEqual({
      cache: true,
      dependsOn: ['^build'],
      inputs: [
        'default',
        '^default',
        {
          json: '{workspaceRoot}/tsconfig.json',
          fields: ['extends', 'files', 'include'],
        },
      ],
    });
    expect(
      readProjectConfiguration(tree, 'mypkg').targets.build.inputs
    ).toBeUndefined();
  });

  it('should use production named inputs when defined', async () => {
    writeJson(tree, 'nx.json', {
      namedInputs: {
        default: ['{projectRoot}/**/*'],
        production: ['default'],
      },
    });
    addProjectConfiguration(tree, 'mypkg', {
      root: 'mypkg',
    });
    tree.write('mypkg/src/main.ts', 'console.log("main");');
    writeJson(tree, 'mypkg/tsconfig.app.json', {});

    await configurationGenerator(tree, {
      project: 'mypkg',
    });

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.targetDefaults['@nx/esbuild:esbuild'].inputs).toEqual([
      'production',
      '^production',
      {
        json: '{workspaceRoot}/tsconfig.json',
        fields: ['extends', 'files', 'include'],
      },
    ]);
  });

  it('should not override existing @nx/esbuild:esbuild target defaults', async () => {
    writeJson(tree, 'nx.json', {
      targetDefaults: {
        '@nx/esbuild:esbuild': {
          cache: true,
          inputs: ['custom-input'],
        },
      },
    });
    addProjectConfiguration(tree, 'mypkg', {
      root: 'mypkg',
    });
    tree.write('mypkg/src/main.ts', 'console.log("main");');
    writeJson(tree, 'mypkg/tsconfig.app.json', {});

    await configurationGenerator(tree, {
      project: 'mypkg',
    });

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson.targetDefaults['@nx/esbuild:esbuild']).toEqual({
      cache: true,
      inputs: ['custom-input'],
    });
  });
});
