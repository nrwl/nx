import {
  addProjectConfiguration,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, { continuousExecutors } from './set-continuous-option';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  formatFiles: jest.fn(),
}));

describe('set-continuous-option migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it.each([...continuousExecutors])(
    'should set continuous option to true for targets using "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {
          serve: {
            executor,
            options: {},
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.serve.continuous).toBe(true);
    }
  );

  it('should not change continuous option when it is already set', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        serve: {
          executor: '@angular-devkit/build-angular:dev-server',
          continuous: false,
          options: {},
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.serve.continuous).toBe(false);
  });

  it('should not modify targets using other executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.continuous).toBeUndefined();
  });
});
