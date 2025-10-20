import { Tree, NxJsonConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateInferredTargets } from './migrate-inferred-targets';
import { MigrationContext, NxDotnetConfig } from './types';

describe('migrateInferredTargets', () => {
  let tree: Tree;
  let nxJson: NxJsonConfiguration;
  let dotnetPlugin: any;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    nxJson = {};
    dotnetPlugin = {
      plugin: '@nx/dotnet',
      options: {},
    };
  });

  it('should return empty result when no inferredTargets exist', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should migrate disabled target (false value)', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        test: false,
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.test).toBe(false);
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]).toContain('inferredTargets');
  });

  it('should migrate renamed target (string value)', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: 'compile',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({ targetName: 'compile' });
    expect(result.completed).toHaveLength(1);
  });

  it('should migrate complex target configuration (object value)', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: {
          cache: false,
          dependsOn: ['^build'],
        },
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({
      cache: false,
      dependsOn: ['^build'],
    });
    expect(result.completed).toHaveLength(1);
  });

  it('should migrate multiple target configurations', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: { cache: true },
        test: false,
        serve: 'dev',
        publish: { cache: false, dependsOn: ['build'] },
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({ cache: true });
    expect(dotnetPlugin.options.test).toBe(false);
    expect(dotnetPlugin.options.serve).toEqual({ targetName: 'dev' });
    expect(dotnetPlugin.options.publish).toEqual({
      cache: false,
      dependsOn: ['build'],
    });
    expect(result.completed).toHaveLength(1);
  });

  it('should initialize plugin options if not present', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: { cache: true },
      },
    };

    dotnetPlugin.options = undefined;

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options).toBeDefined();
    expect(dotnetPlugin.options.build).toEqual({ cache: true });
    expect(result.completed).toHaveLength(1);
  });

  it('should handle target rename with targetName property', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: 'compile-dotnet',
        test: 'run-tests',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({
      targetName: 'compile-dotnet',
    });
    expect(dotnetPlugin.options.test).toEqual({ targetName: 'run-tests' });
    expect(result.completed).toHaveLength(1);
  });

  it('should handle complex configuration with inputs and outputs', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: {
          cache: true,
          inputs: ['production', '^production'],
          outputs: ['{projectRoot}/bin', '{projectRoot}/obj'],
          dependsOn: ['^build', 'prebuild'],
        },
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({
      cache: true,
      inputs: ['production', '^production'],
      outputs: ['{projectRoot}/bin', '{projectRoot}/obj'],
      dependsOn: ['^build', 'prebuild'],
    });
    expect(result.completed).toHaveLength(1);
  });

  it('should handle empty inferredTargets object', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {},
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(result.completed).toHaveLength(1);
    expect(dotnetPlugin.options).toEqual({});
  });

  it('should handle all standard dotnet targets', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: { cache: true },
        test: { cache: true },
        serve: { cache: false },
        clean: { cache: false },
        restore: { cache: true },
        publish: { cache: false, dependsOn: ['build'] },
        pack: { cache: true, dependsOn: ['build'] },
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({ cache: true });
    expect(dotnetPlugin.options.test).toEqual({ cache: true });
    expect(dotnetPlugin.options.serve).toEqual({ cache: false });
    expect(dotnetPlugin.options.clean).toEqual({ cache: false });
    expect(dotnetPlugin.options.restore).toEqual({ cache: true });
    expect(dotnetPlugin.options.publish).toEqual({
      cache: false,
      dependsOn: ['build'],
    });
    expect(dotnetPlugin.options.pack).toEqual({
      cache: true,
      dependsOn: ['build'],
    });
    expect(result.completed).toHaveLength(1);
  });

  it('should handle mixed disable, rename, and configure', () => {
    const rcConfig: NxDotnetConfig = {
      inferredTargets: {
        build: 'compile', // rename
        test: false, // disable
        serve: { cache: false, targetName: 'dev' }, // rename + configure
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateInferredTargets(context);

    expect(dotnetPlugin.options.build).toEqual({ targetName: 'compile' });
    expect(dotnetPlugin.options.test).toBe(false);
    expect(dotnetPlugin.options.serve).toEqual({
      cache: false,
      targetName: 'dev',
    });
    expect(result.completed).toHaveLength(1);
  });
});
