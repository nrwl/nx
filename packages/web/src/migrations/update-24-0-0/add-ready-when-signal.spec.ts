import { addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-ready-when-signal';

describe('add-ready-when-signal migration', () => {
  it('adds a signal readyWhen to @nx/web:file-server targets only', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        'serve-static': { executor: '@nx/web:file-server' },
        'serve-ssr': { executor: '@nx/webpack:ssr-dev-server' },
      },
    });

    await update(tree);

    const { targets } = readProjectConfiguration(tree, 'app');
    expect(targets['serve-static'].readyWhen).toEqual({ signal: true });
    expect(targets['serve-ssr'].readyWhen).toBeUndefined();
  });

  it.each([
    [
      'shorthand target and configuration',
      'build:production',
      undefined,
      ['build'],
    ],
    [
      'in another project',
      'other:build',
      ['^build'],
      ['^build', { projects: ['other'], target: 'build' }],
    ],
    ['the default configuration', 'app:build:production', undefined, ['build']],
    ['already a dependency', 'app:build', [{ target: 'build' }], undefined],
    [
      'the same target of another project not yet a dependency',
      'other:build',
      [{ target: 'build' }],
      [{ target: 'build' }, { projects: ['other'], target: 'build' }],
    ],
  ])(
    'makes the file server depend on its build target: %s',
    async (_, buildTarget, dependsOn, expected) => {
      const tree = createTreeWithEmptyWorkspace();
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: {
            executor: '@nx/web:webpack',
            defaultConfiguration: 'production',
            configurations: { production: {}, development: {} },
          },
          'serve-static': {
            executor: '@nx/web:file-server',
            dependsOn,
            options: { buildTarget },
          },
        },
      });
      addProjectConfiguration(tree, 'other', {
        root: 'apps/other',
        targets: { build: { executor: '@nx/web:webpack' } },
      });

      await update(tree);

      const { targets } = readProjectConfiguration(tree, 'app');
      expect(targets['serve-static'].readyWhen).toEqual({ signal: true });
      expect(targets['serve-static'].dependsOn).toEqual(expected ?? dependsOn);
    }
  );

  it.each([
    [
      'a non-default configuration',
      { options: { buildTarget: 'app:build:development' } },
    ],
    [
      'a configuration that sets its own buildTarget',
      {
        options: { buildTarget: 'app:build' },
        configurations: { ci: { buildTarget: 'app:build:development' } },
      },
    ],
  ])('leaves the file server untouched for %s', async (_, serve) => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        build: {
          executor: '@nx/web:webpack',
          defaultConfiguration: 'production',
          configurations: { production: {}, development: {} },
        },
        'serve-static': { executor: '@nx/web:file-server', ...serve },
      },
    });

    const result = await update(tree);

    expect(result).toEqual({ skipAgentic: true });
    const { targets } = readProjectConfiguration(tree, 'app');
    expect(targets['serve-static'].readyWhen).toBeUndefined();
    expect(targets['serve-static'].dependsOn).toBeUndefined();
  });
});
