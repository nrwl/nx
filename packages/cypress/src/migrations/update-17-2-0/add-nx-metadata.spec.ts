import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import update from './add-nx-metadata';

describe('add-nx-metadata migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    tree.write(
      'e2e/cypress.config.ts',
      `
      import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename),
  },
});
    `
    );
  });

  it('should add nx metadata for dev server target', async () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            devServerTarget: 'my-app:serve',
          },
        },
      },
    });

    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should add nx metadata for production, ci and dev server targets', async () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            devServerTarget: 'my-app:serve',
          },
          configurations: {
            production: {
              devServerTarget: 'my-app:serve:production',
            },
            ci: {
              devServerTarget: 'my-app:serve-static',
            },
          },
        },
      },
    });
    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should nto add nx metadata for if there are none to add', async () => {
    addProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {},
        },
      },
    });
    await update(tree);

    expect(tree.read('e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });
});
