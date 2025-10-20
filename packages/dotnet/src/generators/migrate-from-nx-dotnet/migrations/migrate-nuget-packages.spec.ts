import { Tree, NxJsonConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateNugetPackages } from './migrate-nuget-packages';
import { MigrationContext, NxDotnetConfig } from './types';

describe('migrateNugetPackages', () => {
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

  it('should return empty result when no nugetPackages exist', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should return empty result when nugetPackages is empty object', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {},
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });

  it('should return manual step when nugetPackages configured', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {
        'Newtonsoft.Json': '13.0.1',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toHaveLength(1);
    expect(result.manualSteps[0]).toContain('Central Package Management');
    expect(result.manualSteps[0]).toContain('Directory.Packages.props');
  });

  it('should return manual step with multiple packages', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {
        'Newtonsoft.Json': '13.0.1',
        AutoMapper: '12.0.0',
        Serilog: '3.0.1',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toHaveLength(1);
    expect(result.manualSteps[0]).toContain('Central Package Management');
  });

  it('should include link to Microsoft documentation', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {
        'Newtonsoft.Json': '13.0.1',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.manualSteps[0]).toContain(
      'https://learn.microsoft.com/en-us/nuget/consume-packages/central-package-management'
    );
  });

  it('should include link to migration tool', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {
        'Newtonsoft.Json': '13.0.1',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.manualSteps[0]).toContain(
      'https://devblogs.microsoft.com/dotnet/dotnet-upgrade-assistant-cpm-upgrade/'
    );
  });

  it('should not modify plugin options', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {
        'Newtonsoft.Json': '13.0.1',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const originalOptions = { ...dotnetPlugin.options };
    migrateNugetPackages(context);

    expect(dotnetPlugin.options).toEqual(originalOptions);
  });

  it('should not create any files', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: {
        'Newtonsoft.Json': '13.0.1',
      },
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    migrateNugetPackages(context);

    expect(tree.exists('Directory.Packages.props')).toBe(false);
  });

  it('should handle undefined nugetPackages', () => {
    const rcConfig: NxDotnetConfig = {
      nugetPackages: undefined,
    };

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateNugetPackages(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toEqual([]);
  });
});
