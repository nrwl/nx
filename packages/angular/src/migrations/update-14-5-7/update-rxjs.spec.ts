import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateRxjs from './update-rxjs';

describe('update-rxjs migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update rxjs version when defined as a dev dependency and greater than 7.0.0', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { rxjs: '~7.0.0' },
    });

    await updateRxjs(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['rxjs']).toEqual('~7.5.0');
  });

  it('should update rxjs version when defined as a dependency and greater than 7.0.0', async () => {
    writeJson(tree, 'package.json', {
      dependencies: { rxjs: '~7.0.0' },
    });

    await updateRxjs(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['rxjs']).toEqual('~7.5.0');
  });

  it('should not update rxjs when it is less than 7.0.0', async () => {
    writeJson(tree, 'package.json', {
      dependencies: { rxjs: '~6.5.0' },
    });

    await updateRxjs(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['rxjs']).toEqual('~6.5.0');
  });

  it('should not update rxjs when it is less than 7.0.0', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { rxjs: '~6.5.0' },
    });

    await updateRxjs(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['rxjs']).toEqual('~6.5.0');
  });
});
