import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-bun-deploy-output-cache-inputs';

const BUN_SETTINGS_INPUT = {
  json: '{workspaceRoot}/package.json',
  fields: ['trustedDependencies', 'patchedDependencies'],
};

describe('add-bun-deploy-output-cache-inputs migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('bun.lock', '{}\n');
  });

  it('adds the settings fields to a target emitting the deploy output', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);
    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      ['default', '^default', BUN_SETTINGS_INPUT]
    );
  });

  it('appends to an overlay that replaces the inferred inputs', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = ['@nx/rspack/plugin'];
    updateNxJson(tree, nxJson);
    tree.write('apps/app1/rspack.config.js', '');
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { build: { inputs: ['production', '^production'] } },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets.build.inputs).toEqual(
      ['production', '^production', BUN_SETTINGS_INPUT]
    );
  });

  it('does nothing on the binary bun.lockb', async () => {
    tree.delete('bun.lock');
    tree.write('bun.lockb', '');
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        build: {
          executor: '@nx/esbuild:esbuild',
          options: { generatePackageJson: true },
        },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'app1').targets.build.inputs
    ).toBeUndefined();
  });
});
