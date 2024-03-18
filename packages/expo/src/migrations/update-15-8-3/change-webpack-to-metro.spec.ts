import {
  addProjectConfiguration,
  getProjects,
  readJson,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-webpack-to-metro';

describe('change-webpack-to-metro', () => {
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
        'export-web': {
          executor: '@nrwl/expo:export',
          options: {},
        },
      },
    });
    tree.write(
      `apps/product/app.json`,
      JSON.stringify({
        expo: {
          web: {
            bundler: 'webpack',
          },
        },
      })
    );
  });

  it(`should update project.json with target export-web and change app.json`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['export-web']).toEqual({
        executor: '@nrwl/expo:export',
        options: {
          bundler: 'metro',
        },
      });

      expect(project.targets['web']).toBeUndefined();
      const appJson = readJson(tree, `apps/product/app.json`);
      expect(appJson.expo.web.bundler).toEqual('metro');
    });
  });
});
