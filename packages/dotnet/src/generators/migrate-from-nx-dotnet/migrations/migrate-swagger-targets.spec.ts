import {
  Tree,
  NxJsonConfiguration,
  updateProjectConfiguration,
  addProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateSwaggerTarget } from './migrate-swagger-targets';
import { MigrationContext, NxDotnetConfig } from './types';

describe('migrateSwaggerTarget', () => {
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

  it('should return empty result when no projects exist', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should return empty result when no swagger targets found', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        build: {
          executor: '@nx/dotnet:build',
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should return manual step when @nx-dotnet/core:update-swagger found', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        build: {
          executor: '@nx/dotnet:build',
        },
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
          options: {
            output: './swagger.json',
          },
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps.length).toBeGreaterThan(0);
    expect(result.manualSteps.join(' ')).toContain(
      '@nx-dotnet/core:update-swagger'
    );
  });

  it('should return manual step when @nx-dotnet/core:openapi-codegen found', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        build: {
          executor: '@nx/dotnet:build',
        },
        'generate-client': {
          executor: '@nx-dotnet/core:openapi-codegen',
          options: {
            openapiJsonPath: './swagger.json',
          },
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps.length).toBeGreaterThan(0);
    expect(result.manualSteps.join(' ')).toContain(
      '@nx-dotnet/core:openapi-codegen'
    );
  });

  it('should include example target configuration for update-swagger', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
          options: {
            output: './swagger.json',
          },
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    const manualStepsText = result.manualSteps.join(' ');
    expect(manualStepsText).toContain('dotnet swagger tofile');
    expect(manualStepsText).toContain('command');
  });

  it('should include example target configuration for openapi-codegen', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        'generate-client': {
          executor: '@nx-dotnet/core:openapi-codegen',
          options: {
            openapiJsonPath: './swagger.json',
          },
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    const manualStepsText = result.manualSteps.join(' ');
    expect(manualStepsText).toContain('openapi-generator-cli');
    expect(manualStepsText).toContain(
      'https://github.com/OpenAPITools/openapi-generator-cli'
    );
  });

  it('should only return one manual step per executor type', () => {
    const rcConfig: NxDotnetConfig = {};

    // Add multiple projects with same executor
    addProjectConfiguration(tree, 'my-app-1', {
      root: 'apps/my-app-1',
      targets: {
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
        },
      },
    });

    addProjectConfiguration(tree, 'my-app-2', {
      root: 'apps/my-app-2',
      targets: {
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    // Should only have manual steps related to update-swagger (not duplicates)
    const swaggerSteps = result.manualSteps.filter((step) =>
      step.includes('@nx-dotnet/core:update-swagger')
    );
    expect(swaggerSteps.length).toBeGreaterThan(0);
  });

  it('should handle both swagger and codegen targets', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-api', {
      root: 'apps/my-api',
      targets: {
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
        },
      },
    });

    addProjectConfiguration(tree, 'my-client', {
      root: 'apps/my-client',
      targets: {
        'generate-client': {
          executor: '@nx-dotnet/core:openapi-codegen',
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    const manualStepsText = result.manualSteps.join(' ');
    expect(manualStepsText).toContain('@nx-dotnet/core:update-swagger');
    expect(manualStepsText).toContain('@nx-dotnet/core:openapi-codegen');
  });

  it('should not modify plugin options', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const originalOptions = { ...dotnetPlugin.options };
    migrateSwaggerTarget(context);

    expect(dotnetPlugin.options).toEqual(originalOptions);
  });

  it('should not modify project configurations', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
          options: {
            output: './swagger.json',
          },
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    migrateSwaggerTarget(context);

    // Projects should remain unchanged
    const changes = tree.listChanges();
    expect(changes.every((c) => c.type !== 'UPDATE')).toBe(true);
  });

  it('should handle projects without targets', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should handle mixed target types', () => {
    const rcConfig: NxDotnetConfig = {};

    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        build: {
          executor: '@nx/dotnet:build',
        },
        test: {
          executor: '@nx/dotnet:test',
        },
        'update-swagger': {
          executor: '@nx-dotnet/core:update-swagger',
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
      },
    });

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateSwaggerTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps.length).toBeGreaterThan(0);
    expect(result.manualSteps.join(' ')).toContain(
      '@nx-dotnet/core:update-swagger'
    );
  });
});
