import { Tree, NxJsonConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { migrateLintTarget } from './migrate-lint-target';
import { MigrationContext, NxDotnetConfig } from './types';

describe('migrateLintTarget', () => {
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

  it('should always return manual step', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateLintTarget(context);

    expect(result.completed).toEqual([]);
    expect(result.manualSteps).toHaveLength(1);
  });

  it('should include dotnet format information', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateLintTarget(context);

    expect(result.manualSteps[0]).toContain('dotnet format');
  });

  it('should mention manual configuration option', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateLintTarget(context);

    expect(result.manualSteps[0]).toContain(
      'configure the targets manually on a per-project basis'
    );
  });

  it('should mention custom plugin option', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const result = migrateLintTarget(context);

    expect(result.manualSteps[0]).toContain('use a custom plugin');
  });

  it('should not modify plugin options', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const originalOptions = { ...dotnetPlugin.options };
    migrateLintTarget(context);

    expect(dotnetPlugin.options).toEqual(originalOptions);
  });

  it('should not create any files', () => {
    const rcConfig: NxDotnetConfig = {};

    const context: MigrationContext = {
      tree,
      rcConfig,
      nxJson,
      dotnetPlugin,
    };

    const changesBefore = tree.listChanges().length;
    migrateLintTarget(context);
    const changesAfter = tree.listChanges().length;

    // Should not create any NEW files
    expect(changesAfter).toEqual(changesBefore);
  });
});
