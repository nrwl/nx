import { Tree, NxJsonConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateTargetDefaults } from './migrate-target-defaults';
import { MigrationContext } from './types';

describe('migrateTargetDefaults', () => {
  let tree: Tree;
  let nxJson: NxJsonConfiguration;
  let dotnetPlugin: any;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    nxJson = {
      targetDefaults: {},
    };
    dotnetPlugin = {
      plugin: '@nx/dotnet',
      options: {},
    };
  });

  it('should return empty result when no targetDefaults exist', () => {
    nxJson.targetDefaults = undefined;

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should migrate @nx-dotnet/core:build to build target', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:build': {
        cache: true,
        dependsOn: ['^build'],
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.build).toEqual({
      cache: true,
      dependsOn: ['^build'],
    });
    expect(nxJson.targetDefaults['@nx-dotnet/core:build']).toBeUndefined();
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]).toContain('@nx-dotnet/core:build');
  });

  it('should migrate @nx-dotnet/core:test to test target', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:test': {
        cache: true,
        inputs: ['default', '^production'],
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.test).toEqual({
      cache: true,
      inputs: ['default', '^production'],
    });
    expect(nxJson.targetDefaults['@nx-dotnet/core:test']).toBeUndefined();
    expect(result.completed).toHaveLength(1);
  });

  it('should migrate @nx-dotnet/core:serve to serve target', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:serve': {
        cache: false,
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.serve).toEqual({
      cache: false,
    });
    expect(nxJson.targetDefaults['@nx-dotnet/core:serve']).toBeUndefined();
    expect(result.completed).toHaveLength(1);
  });

  it('should migrate @nx-dotnet/core:publish to publish target', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:publish': {
        cache: false,
        dependsOn: ['build'],
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.publish).toEqual({
      cache: false,
      dependsOn: ['build'],
    });
    expect(nxJson.targetDefaults['@nx-dotnet/core:publish']).toBeUndefined();
    expect(result.completed).toHaveLength(1);
  });

  it('should migrate multiple executors at once', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:build': {
        cache: true,
      },
      '@nx-dotnet/core:test': {
        cache: true,
      },
      '@nx-dotnet/core:serve': {
        cache: false,
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.build).toEqual({ cache: true });
    expect(dotnetPlugin.options.test).toEqual({ cache: true });
    expect(dotnetPlugin.options.serve).toEqual({ cache: false });
    expect(nxJson.targetDefaults['@nx-dotnet/core:build']).toBeUndefined();
    expect(nxJson.targetDefaults['@nx-dotnet/core:test']).toBeUndefined();
    expect(nxJson.targetDefaults['@nx-dotnet/core:serve']).toBeUndefined();
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]).toContain('@nx-dotnet/core:build');
    expect(result.completed[0]).toContain('@nx-dotnet/core:test');
    expect(result.completed[0]).toContain('@nx-dotnet/core:serve');
  });

  it('should merge configs when target already exists in plugin options', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:build': {
        cache: true,
        dependsOn: ['^build'],
      },
    };

    dotnetPlugin.options.build = {
      inputs: ['production', '^production'],
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.build).toEqual({
      inputs: ['production', '^production'],
      cache: true,
      dependsOn: ['^build'],
    });
    expect(result.completed).toHaveLength(1);
  });

  it('should not migrate non-dotnet executors', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:build': {
        cache: true,
      },
      '@nx/js:tsc': {
        cache: true,
      },
      build: {
        cache: true,
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.build).toEqual({ cache: true });
    expect(nxJson.targetDefaults['@nx/js:tsc']).toEqual({ cache: true });
    expect(nxJson.targetDefaults['build']).toEqual({ cache: true });
    expect(result.completed).toHaveLength(1);
  });

  it('should handle empty targetDefaults object', () => {
    nxJson.targetDefaults = {};

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
    expect(dotnetPlugin.options).toEqual({});
  });

  it('should initialize plugin options if not present', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:build': {
        cache: true,
      },
    };

    dotnetPlugin.options = undefined;

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options).toBeDefined();
    expect(dotnetPlugin.options.build).toEqual({ cache: true });
    expect(result.completed).toHaveLength(1);
  });

  it('should handle complex target configurations', () => {
    nxJson.targetDefaults = {
      '@nx-dotnet/core:build': {
        cache: true,
        dependsOn: ['^build', 'prebuild'],
        inputs: ['production', '^production', '{workspaceRoot}/global.json'],
        outputs: ['{projectRoot}/bin', '{projectRoot}/obj'],
        executor: '@nx-dotnet/core:build',
        options: {
          configuration: 'Release',
          noDependencies: true,
        },
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig: {},
      nxJson,
      dotnetPlugin,
    };

    const result = migrateTargetDefaults(context);

    expect(dotnetPlugin.options.build).toEqual({
      cache: true,
      dependsOn: ['^build', 'prebuild'],
      inputs: ['production', '^production', '{workspaceRoot}/global.json'],
      outputs: ['{projectRoot}/bin', '{projectRoot}/obj'],
      executor: '@nx-dotnet/core:build',
      options: {
        configuration: 'Release',
        noDependencies: true,
      },
    });
    expect(result.completed).toHaveLength(1);
  });
});
