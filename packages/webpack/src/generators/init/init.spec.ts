import { Tree, readJson, NxJsonConfiguration, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { webpackInitGenerator } from './init';

describe('webpackInitGenerator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should support babel', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs = {
        sharedGlobals: ['{workspaceRoot}/exiting-file.json'],
      };
      return json;
    });

    await webpackInitGenerator(tree, { compiler: 'babel' });

    expect(tree.exists('babel.config.json'));
    const sharedGlobals = readJson<NxJsonConfiguration>(tree, 'nx.json')
      .namedInputs.sharedGlobals;
    expect(sharedGlobals).toContain('{workspaceRoot}/exiting-file.json');
    expect(sharedGlobals).toContain('{workspaceRoot}/babel.config.json');
  });

  it('should support swc', async () => {
    await webpackInitGenerator(tree, { compiler: 'swc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nrwl/webpack': expect.any(String),
        '@swc/helpers': expect.any(String),
        '@swc/core': expect.any(String),
        'swc-loader': expect.any(String),
      },
    });
  });

  it('should support tsc', async () => {
    await webpackInitGenerator(tree, { compiler: 'tsc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@nrwl/webpack': expect.any(String),
        tslib: expect.any(String),
      },
    });
  });
});
