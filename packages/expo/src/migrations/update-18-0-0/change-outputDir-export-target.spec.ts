import { addProjectConfiguration, getProjects, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './change-outputDir-export-target';

describe('change-outputDir-export-target', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'product', {
      root: 'apps/product',
      sourceRoot: 'apps/product/src',
      targets: {
        export: {
          executor: '@nx/expo:export',
          options: {
            platform: 'all',
            outputDir: '../../dist/apps/dogs',
          },
          dependsOn: ['sync-deps'],
        },
      },
    });
  });

  it(`should remove offset from outputDir`, async () => {
    await update(tree);

    getProjects(tree).forEach((project) => {
      expect(project.targets['export']).toEqual({
        dependsOn: ['sync-deps'],
        executor: '@nx/expo:export',
        options: {
          outputDir: 'dist/apps/dogs',
          platform: 'all',
        },
        outputs: ['{options.outputDir}'],
      });
    });
  });
});
