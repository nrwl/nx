import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-detox-app-json';

describe('add-eas-update-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        start: {
          executor: '@nrwl/expo:start',
        },
      },
    });
    tree.write('apps/product/app.json', '{"expo": {}}');
  });

  it(`should update app.json with plugin detox`, async () => {
    await update(tree);

    const appJson = JSON.parse(tree.read('apps/product/app.json').toString());
    expect(appJson).toEqual({
      expo: {
        plugins: [
          [
            '@config-plugins/detox',
            {
              skipProguard: false,
              subdomains: ['10.0.2.2', 'localhost'],
            },
          ],
        ],
      },
    });
  });
});
