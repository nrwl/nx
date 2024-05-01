import {
  addProjectConfiguration,
  readJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './setup-unocss';

describe('vue setup-unocss generator', () => {

  it('should install packages', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'example', {
      root: 'example',
      sourceRoot: 'example/src',
      targets: {},
    });
    writeJson(tree, 'package.json', {
      dependencies: {
        vue: '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
    });

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        vue: '999.9.9',
      },
      devDependencies: {
        unocss: expect.any(String),
      },
    });
  });

  it('should support skipping package install', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'example', {
      root: 'example',
      sourceRoot: 'example/src',
      targets: {},
    });
    writeJson(tree, 'package.json', {
      dependencies: {
        vue: '999.9.9',
      },
    });

    await update(tree, {
      project: 'example',
      skipPackageJson: true,
    });

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: {
        vue: '999.9.9',
      },
    });
  });
});
