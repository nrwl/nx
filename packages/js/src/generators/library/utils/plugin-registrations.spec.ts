import type { NxJsonConfiguration } from '@nx/devkit';
import {
  ensureProjectIsExcludedFromPluginRegistrations,
  ensureProjectIsIncludedInPluginRegistrations,
} from './plugin-registrations';

describe('ensureProjectIsIncludedInPluginRegistrations', () => {
  it('should do nothing when there is no `plugin` entry', () => {
    const nxJson: NxJsonConfiguration = {};

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({});
  });

  it('should do nothing when the there are no plugins', () => {
    const nxJson: NxJsonConfiguration = { plugins: [] };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({ plugins: [] });
  });

  it('should do nothing when the are no registrations for the `@nx/js/typescript` plugin', () => {
    const nxJson: NxJsonConfiguration = { plugins: ['@foo/bar/plugin'] };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({ plugins: ['@foo/bar/plugin'] });
  });

  it('should do nothing when `include`/`exclude` are not set in a plugin registration that infers both targets', () => {
    const originalNxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };
    const nxJson = structuredClone(originalNxJson);

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toEqual(originalNxJson);
  });

  it('should do nothing when `include` is set in a plugin registration that infers both targets and the project is already included', () => {
    const originalNxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };
    const nxJson = structuredClone(originalNxJson);

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toEqual(originalNxJson);
  });

  it('should do nothing when `exclude` is set in a plugin registration that infers both targets and the project is not excluded', () => {
    const originalNxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };
    const nxJson = structuredClone(originalNxJson);

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg2');

    expect(nxJson).toEqual(originalNxJson);
  });

  it('should exclude a project from a string plugin registration and add a new plugin registration that includes it', () => {
    const nxJson: NxJsonConfiguration = { plugins: ['@nx/js/typescript'] };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
        },
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    });
  });

  it('should exclude a project from a plugin registration missing the `typecheck` target and add a new plugin registration that includes it', () => {
    const nxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          options: {
            typecheck: false,
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
          options: {
            typecheck: false,
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    });
  });

  it('should exclude a project from a plugin registration missing the `build` target and add a new plugin registration that includes it', () => {
    const nxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          options: { typecheck: { targetName: 'typecheck' } },
        },
      ],
    };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
          options: { typecheck: { targetName: 'typecheck' } },
        },
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    });
  });

  it('should include a project in a plugin registration that infers both targets and with `include` set but not including the project', () => {
    const nxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg2');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*', 'packages/pkg2/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    });
  });

  it('should add a new plugin registration including the project when there is an existing plugin registration that infers both targets and with `exclude` set excluding the project', () => {
    const nxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/**/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };

    ensureProjectIsIncludedInPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/**/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    });
  });
});

describe('ensureProjectIsExcludedFromPluginRegistrations', () => {
  it('should do nothing when there is no `plugin` entry', () => {
    const nxJson: NxJsonConfiguration = {};

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({});
  });

  it('should do nothing when the there are no plugins', () => {
    const nxJson: NxJsonConfiguration = { plugins: [] };

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({ plugins: [] });
  });

  it('should do nothing when the are no registrations for the `@nx/js/typescript` plugin', () => {
    const nxJson: NxJsonConfiguration = { plugins: ['@foo/bar/plugin'] };

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({ plugins: ['@foo/bar/plugin'] });
  });

  it('should do nothing when the plugin registration does not infer any of the targets', () => {
    const nxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          options: { typecheck: false },
        },
      ],
    };

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          options: { typecheck: false },
        },
      ],
    });
  });

  it('should do nothing when `include` is set in a plugin registration that infers any of the targets and the project is not included', () => {
    const originalNxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          include: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
          },
        },
      ],
    };
    const nxJson = structuredClone(originalNxJson);

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg2');

    expect(nxJson).toEqual(originalNxJson);
  });

  it('should do nothing when `exclude` is set in a plugin registration that infers any of the targets and the project is already excluded', () => {
    const originalNxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
          options: {
            typecheck: false,
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };
    const nxJson = structuredClone(originalNxJson);

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toEqual(originalNxJson);
  });

  it('should exclude a project from a string plugin registration', () => {
    const nxJson: NxJsonConfiguration = { plugins: ['@nx/js/typescript'] };

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
        },
      ],
    });
  });

  it('should exclude a project from a plugin registration that infers any of the targets', () => {
    const nxJson: NxJsonConfiguration = {
      plugins: [
        {
          plugin: '@nx/js/typescript',
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    };

    ensureProjectIsExcludedFromPluginRegistrations(nxJson, 'packages/pkg1');

    expect(nxJson).toStrictEqual({
      plugins: [
        {
          plugin: '@nx/js/typescript',
          exclude: ['packages/pkg1/*'],
          options: {
            typecheck: { targetName: 'typecheck' },
            build: {
              targetName: 'build',
              configName: 'tsconfig.lib.json',
            },
          },
        },
      ],
    });
  });
});
