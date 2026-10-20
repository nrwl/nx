import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-start-storybook-ready-when';

const executor = '@storybook/angular:start-storybook';

describe('add-start-storybook-ready-when migration', () => {
  it('adds a port check readyWhen to @storybook/angular:start-storybook targets that set none', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        storybook: { executor, continuous: true, options: { port: 4400 } },
        'storybook-opt-out': { executor, continuous: true, readyWhen: null },
        'build-storybook': { executor: '@storybook/angular:build-storybook' },
      },
    });

    await update(tree);

    const { targets } = readProjectConfiguration(tree, 'app');
    expect(targets.storybook.readyWhen).toEqual({
      port: '{env.SBCONFIG_PORT ?? options.port ?? 9009}',
      host: '{env.SBCONFIG_HOSTNAME ?? options.host ?? localhost}',
    });
    expect(targets['storybook-opt-out'].readyWhen).toBeNull();
    expect(targets['build-storybook'].readyWhen).toBeUndefined();
  });

  it('makes @storybook/angular:start-storybook targets continuous unless they or the targetDefaults that apply to them set it, or they run a smoke test, own or inherited', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      targets: {
        storybook: { executor },
        'storybook-smoke': { executor, options: { smokeTest: true } },
        'storybook-smoke-ci': {
          executor,
          configurations: { ci: { smokeTest: true } },
        },
        'storybook-smoke-default': { executor },
        'storybook-smoke-default-ci': { executor },
        'storybook-smoke-overridden': {
          executor,
          options: { smokeTest: false },
        },
        'storybook-defaulted': { executor },
        'storybook-other-default': { executor },
      },
    });
    updateNxJson(tree, {
      ...readNxJson(tree),
      targetDefaults: {
        'storybook-smoke-default': { options: { smokeTest: true } },
        'storybook-smoke-default-ci': {
          configurations: { ci: { smokeTest: true } },
        },
        'storybook-smoke-overridden': { options: { smokeTest: true } },
        'storybook-defaulted': { continuous: false },
        'storybook-other-default': {
          executor: '@nx/web:file-server',
          continuous: false,
        },
      },
    });

    await update(tree);

    const { targets } = readProjectConfiguration(tree, 'app');
    expect(targets.storybook.continuous).toBe(true);
    expect(targets['storybook-smoke'].continuous).toBeUndefined();
    expect(targets['storybook-smoke-ci'].continuous).toBeUndefined();
    expect(targets['storybook-smoke-default'].continuous).toBeUndefined();
    expect(targets['storybook-smoke-default-ci'].continuous).toBeUndefined();
    expect(targets['storybook-smoke-overridden'].continuous).toBe(true);
    expect(targets['storybook-defaulted'].continuous).toBeUndefined();
    expect(targets['storybook-other-default'].continuous).toBe(true);
  });
});
