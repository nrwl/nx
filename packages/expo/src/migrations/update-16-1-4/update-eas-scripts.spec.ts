import {
  Tree,
  addProjectConfiguration,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './update-eas-scripts';

describe('update-eas-scripts', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'products', {
      root: 'apps/products',
      sourceRoot: 'apps/products/src',
      targets: {
        start: {
          executor: '@nrwl/expo:start',
        },
      },
    });
    tree.write('apps/products/package.json', JSON.stringify({}));
  });

  it('should add scripts', async () => {
    update(tree);

    expect(tree.exists('tools/scripts/eas-build-pre-install.mjs')).toBeTruthy();
    expect(
      tree.exists('tools/scripts/eas-build-post-install.mjs')
    ).toBeTruthy();
    const packageJson = readJson(tree, 'apps/products/package.json');
    expect(packageJson.scripts['eas-build-pre-install']).toEqual(
      'cd ../../ && node tools/scripts/eas-build-pre-install.mjs . apps/products && cp package-lock.json apps/products'
    );
    expect(packageJson.scripts['eas-build-post-install']).toEqual(
      'cd ../../ && node tools/scripts/eas-build-post-install.mjs . apps/products'
    );
  });

  it('should remove postinstall script', async () => {
    updateJson(tree, 'apps/products/package.json', (json) => {
      json.scripts = {
        postinstall: 'some script',
      };
      return json;
    });
    update(tree);

    const packageJson = readJson(tree, 'apps/products/package.json');
    expect(packageJson.scripts['postinstall']).toBeUndefined();
  });
});
