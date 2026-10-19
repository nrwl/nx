import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type TargetConfiguration,
  type TargetDefaults,
} from '@nx/devkit';
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

  it.each<
    [
      string,
      TargetConfiguration,
      TargetDefaults,
      TargetConfiguration['dependsOn'],
    ]
  >([
    [
      'set dependsOn for the executor',
      { options: { buildTarget: 'app:build' } },
      { '@nx/web:file-server': { dependsOn: ['prepare'] } },
      ['...', 'build'],
    ],
    [
      'set dependsOn for the target name',
      { options: { buildTarget: 'app:build' } },
      { 'serve-static': { dependsOn: ['prepare'] } },
      ['...', 'build'],
    ],
    [
      'set a buildTarget with {projectName}',
      {},
      {
        '@nx/web:file-server': {
          options: { buildTarget: '{projectName}:build' },
        },
      },
      ['build'],
    ],
    [
      'set a dependsOn that names the build',
      { options: { buildTarget: 'app:build' } },
      { '@nx/web:file-server': { dependsOn: ['build'] } },
      undefined,
    ],
    [
      'set a dependsOn the target replaces with its own',
      { dependsOn: ['prepare'], options: { buildTarget: 'app:build' } },
      { '@nx/web:file-server': { dependsOn: ['lint'] } },
      ['prepare', 'build'],
    ],
    [
      'set the defaultConfiguration of the build target',
      { options: { buildTarget: 'app:build:production' } },
      { build: { defaultConfiguration: 'production' } },
      ['build'],
    ],
    [
      'set a configuration the build target does not have',
      { options: { buildTarget: 'app:build' } },
      { '@nx/web:file-server': { configurations: { ci: { port: 4300 } } } },
      ['build'],
    ],
  ])(
    'makes the file server depend on its build target with targetDefaults that %s',
    async (_, serve, targetDefaults, dependsOn) => {
      const tree = createTreeWithEmptyWorkspace();
      updateNxJson(tree, { ...readNxJson(tree), targetDefaults });
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: { executor: '@nx/web:webpack' },
          'serve-static': { executor: '@nx/web:file-server', ...serve },
        },
      });

      await update(tree);

      expect(
        readProjectConfiguration(tree, 'app').targets['serve-static']
      ).toEqual({
        executor: '@nx/web:file-server',
        ...serve,
        readyWhen: { signal: true },
        dependsOn,
      });
    }
  );

  it.each<[string, TargetConfiguration, TargetDefaults?, TargetConfiguration?]>(
    [
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
      [
        'a configuration whose buildTarget comes from targetDefaults',
        { options: { buildTarget: 'app:build' } },
        {
          '@nx/web:file-server': {
            configurations: { ci: { buildTarget: 'app:build:development' } },
          },
        },
      ],
      [
        'a command build target whose defaultConfiguration comes from targetDefaults',
        { options: { buildTarget: 'app:build:production' } },
        { build: { defaultConfiguration: 'production' } },
        {
          command: 'webpack build',
          configurations: { production: {}, development: {} },
        },
      ],
      [
        'a run-commands build target whose targetDefaults run another command',
        { options: { buildTarget: 'app:build:production' } },
        {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'vite build' },
            defaultConfiguration: 'production',
          },
        },
        {
          executor: 'nx:run-commands',
          options: { command: 'webpack build' },
          configurations: { production: {}, development: {} },
        },
      ],
      [
        'a configuration the build target also has',
        {
          options: { buildTarget: 'app:build:production' },
          configurations: { development: { port: 4300 } },
        },
      ],
      [
        'a configuration the build target has from targetDefaults',
        {
          options: { buildTarget: 'app:build:production' },
          configurations: { development: { port: 4300 } },
        },
        { build: { configurations: { development: {} } } },
        {
          executor: '@nx/web:webpack',
          defaultConfiguration: 'production',
          configurations: { production: {} },
        },
      ],
      [
        'a configuration from targetDefaults that the build target also has',
        { options: { buildTarget: 'app:build' } },
        {
          '@nx/web:file-server': {
            configurations: { development: { port: 4300 } },
          },
        },
      ],
      [
        'a configuration when the build target is not in project.json',
        {
          options: { buildTarget: 'app:compile' },
          configurations: { ci: { port: 4300 } },
        },
      ],
      [
        'a configuration when project.json only overrides an inferred build target',
        {
          options: { buildTarget: 'app:build' },
          configurations: { ci: { port: 4300 } },
        },
        undefined,
        { options: { outputPath: 'dist/apps/app' } },
      ],
    ]
  )(
    'leaves the file server untouched for %s',
    async (_, serve, targetDefaults, build) => {
      const tree = createTreeWithEmptyWorkspace();
      if (targetDefaults) {
        updateNxJson(tree, { ...readNxJson(tree), targetDefaults });
      }
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        targets: {
          build: build ?? {
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
    }
  );
});
