import {
  addProjectConfiguration,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, {
  executorsToAddPolyfillTo,
} from './add-localize-polyfill-to-targets';

describe('add-localize-polyfill-to-targets migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  test.each(executorsToAddPolyfillTo)(
    'should add the "@angular/localize/init" polyfill when using the "%s" executor and the "localize" option is enabled',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { build: { executor, options: { localize: true } } },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.options.polyfills).toStrictEqual([
        '@angular/localize/init',
      ]);
    }
  );

  test.each(executorsToAddPolyfillTo)(
    'should add the "@angular/localize/init" polyfill when using the "%s" executor and the "localize" option is enabled in a configuration',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {
          build: {
            executor,
            configurations: { production: { localize: true } },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.options.polyfills).toStrictEqual([
        '@angular/localize/init',
      ]);
    }
  );

  test.each(executorsToAddPolyfillTo)(
    'should not duplicate the "@angular/localize/init" polyfill when using the "%s" executor and the polyfill is already present',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {
          build: {
            executor,
            options: { localize: true, polyfills: ['@angular/localize/init'] },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.options.polyfills).toStrictEqual([
        '@angular/localize/init',
      ]);
    }
  );

  test.each(executorsToAddPolyfillTo)(
    'should add the "@angular/localize/init" polyfill when target is a string when using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {
          build: {
            executor,
            options: { localize: true, polyfills: 'some-other-polyfill' },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.options.polyfills).toStrictEqual([
        'some-other-polyfill',
        '@angular/localize/init',
      ]);
    }
  );

  test.each(executorsToAddPolyfillTo)(
    'should not add the "@angular/localize/init" polyfill when using the "%s" executor and the "localize" option is disabled',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: { build: { executor, options: { localize: false } } },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.options.polyfills).toBeUndefined();
    }
  );

  test('should not add the "@angular/localize/init" polyfill when not using one of the targeted executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@my-org/some:awesome-executor',
          options: { localize: true },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.polyfills).toBeUndefined();
  });
});
