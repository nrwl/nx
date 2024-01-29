import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import generator from './cypress.impl';
import applicationGenerator from '../application/application.impl';

describe('Cypress generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate cypress project', async () => {
    await applicationGenerator(tree, { name: 'demo', e2eTestRunner: 'none' });
    await generator(tree, { project: 'demo', name: 'demo-e2e' });

    const config = readProjectConfiguration(tree, 'demo-e2e');
    expect(config.targets).toEqual({
      e2e: {
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'demo-e2e/cypress.config.ts',
          testingType: 'e2e',
          devServerTarget: 'demo:serve:development',
        },
        configurations: {
          ci: {
            devServerTarget: 'demo:serve-static',
          },
        },
      },
    });
  });
});
