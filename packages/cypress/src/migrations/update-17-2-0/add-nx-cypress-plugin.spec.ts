import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import update from './add-nx-cypress-plugin';
import { NxCypressMetadata } from '../../plugins/plugin';
import { defineConfig } from 'cypress';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';

describe('add-nx-cypress-plugin migration', () => {
  let tree: Tree;
  let tempFs: TempFs;

  function mockCypressConfig(
    cypressConfig: Cypress.ConfigOptions,
    nxMetadata?: NxCypressMetadata
  ) {
    jest.mock(
      join(tempFs.tempDir, 'e2e/cypress.config.ts'),
      () => ({
        default: cypressConfig,
        nx: nxMetadata,
      }),
      {
        virtual: true,
      }
    );
  }

  beforeEach(async () => {
    tempFs = new TempFs('test');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;
    await tempFs.createFiles({
      'e2e/cypress.config.ts': '',
      'e2e/project.json': '{ "name": "e2e" }',
    });
    tree.write('e2e/cypress.config.ts', `console.log('hi');`);
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
  });

  it('should remove the e2e target when there are no other options', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {},
      }),
      {
        devServerTarget: 'my-app:serve',
        productionDevServerTarget: 'my-app:serve:production',
        ciDevServerTarget: 'my-app:serve-static',
      }
    );
    updateProjectConfiguration(tree, 'e2e', {
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

    expect(readProjectConfiguration(tree, 'e2e').targets.e2e).toBeUndefined();
  });

  it('should not the e2e target when it uses a different executor', async () => {
    const e2eTarget = {
      executor: '@nx/playwright:playwright',
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
    };
    updateProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: e2eTarget,
      },
    });

    await update(tree);

    expect(readProjectConfiguration(tree, 'e2e').targets.e2e).toEqual(
      e2eTarget
    );
  });

  it('should leave the e2e target with other options', async () => {
    mockCypressConfig(
      defineConfig({
        e2e: {},
      }),
      {
        devServerTarget: 'my-app:serve',
        productionDevServerTarget: 'my-app:serve:production',
        ciDevServerTarget: 'my-app:serve-static',
      }
    );
    updateProjectConfiguration(tree, 'e2e', {
      root: 'e2e',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            devServerTarget: 'my-app:serve',
            watch: false,
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

    expect(readProjectConfiguration(tree, 'e2e').targets.e2e).toEqual({
      options: {
        watch: false,
      },
    });
  });
});
