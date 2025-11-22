import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { createTreeWithEmptyWorkspace } from '../generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from '../generators/utils/project-configuration';
import {
  arrayBufferToString,
  restoreNxTokensInOptions,
  wrapAngularDevkitSchematic,
} from './ngcli-adapter';

jest.mock('../project-graph/project-graph', () => ({
  ...jest.requireActual('../project-graph/project-graph'),
  createProjectGraphAsync: () => ({
    nodes: {},
    externalNodes: {},
  }),
}));

describe('ngcli-adapter', () => {
  it('arrayBufferToString should support large buffers', () => {
    const largeString = 'a'.repeat(1000000);

    const result = arrayBufferToString(Buffer.from(largeString));

    expect(result).toBe(largeString);
  });

  it('should correctly wrapAngularDevkitSchematics', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'test', { root: '', sourceRoot: 'src' });

    const wrappedSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'class'
    );

    // ACT
    await wrappedSchematic(tree, { name: 'test', project: 'test' });

    // ASSERT
    expect(tree.exists('src/lib/test.ts')).toBeTruthy();
  });

  describe('restoreNxTokensInOptions', () => {
    const project: ProjectConfiguration = {
      name: 'lib1',
      root: 'libs/lib1',
      targets: {},
    };

    it('should restore {projectRoot} if the new value matches the resolved previous value', () => {
      const previousValue = { outputPath: '{projectRoot}/dist' }; // libs/lib1/dist
      const newValue = { outputPath: 'libs/lib1/dist' };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual(previousValue);
    });

    it('should restore {projectRoot} if the new value is different but starts with the project root', () => {
      const previousValue = { outputPath: '{projectRoot}/dist' }; // libs/lib1/dist
      const newValue = { outputPath: 'libs/lib1/dist/app' };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual({ outputPath: '{projectRoot}/dist/app' });
    });

    it('should not restore {projectRoot} if the new value is different and does not start with the project root', () => {
      const previousValue = { outputPath: '{projectRoot}/dist' }; // libs/lib1/dist
      const newValue = { outputPath: 'dist/libs/lib1' };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual(newValue);
    });

    it('should restore {workspaceRoot} if the new value matches the resolved previous value', () => {
      const previousValue = { config: '{workspaceRoot}/global.json' }; // global.json
      const newValue = { config: 'global.json' };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual(previousValue);
    });

    it('should restore {projectName} if the new value matches the resolved previous value', () => {
      const previousValue = { folder: '{projectName}/src' }; // lib1/src
      const newValue = { folder: 'lib1/src' };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual(previousValue);
    });

    it('should handle nested objects', () => {
      const previousValue = { a: { b: '{projectRoot}/foo' } }; // libs/lib1/foo
      const newValue = { a: { b: 'libs/lib1/foo' } };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual(previousValue);
    });

    it('should handle arrays of objects', () => {
      const previousValue = {
        arr: [{ path: '{projectRoot}/foo' }, { path: '{projectRoot}/bar' }], // libs/lib1/foo, libs/lib1/bar
      };
      const newValue = {
        arr: [{ path: 'libs/lib1/foo' }, { path: 'libs/lib1/bar' }],
      };

      expect(
        restoreNxTokensInOptions(newValue, previousValue, project)
      ).toEqual(previousValue);
    });

    it('should prefix new value with {workspaceRoot}/ if previous started with {workspaceRoot}/ and value changed', () => {
      const prev = { config: '{workspaceRoot}/global.json' };
      const next = { config: 'changed.json' };
      expect(restoreNxTokensInOptions(next, prev, project)).toEqual({
        config: '{workspaceRoot}/changed.json',
      });
    });

    it('should not double slash when new value starts with a slash and previous started with {workspaceRoot}/', () => {
      const prev = { config: '{workspaceRoot}/global.json' };
      const next = { config: '/changed.json' };
      expect(restoreNxTokensInOptions(next, prev, project)).toEqual({
        config: '{workspaceRoot}/changed.json',
      });
    });
  });
});

describe('NxScopeHostUsedForWrappedSchematics', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should merge target defaults into project configuration', async () => {
    const { NxScopeHostUsedForWrappedSchematics } = require('./ngcli-adapter');
    const tree = createTreeWithEmptyWorkspace();
    const projectConfig = {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/angular:package',
          options: {},
        },
      },
    };
    addProjectConfiguration(tree, 'lib1', projectConfig as any);

    // Mock nx.json with target defaults (mock from the actual import source)
    const nxJsonUtils = require('../generators/utils/nx-json');
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      targetDefaults: {
        build: {
          options: {
            project: 'libs/lib1/ng-package.json',
          },
        },
      },
    });

    // Mock isAngularPluginInstalled to return true so the adapter logic triggers
    const angularJsonUtils = require('./angular-json');
    jest
      .spyOn(angularJsonUtils, 'isAngularPluginInstalled')
      .mockReturnValue(true);

    const host = new NxScopeHostUsedForWrappedSchematics(tree.root, tree);

    // Read angular.json which should trigger the merging logic
    const content = await host.read('angular.json').toPromise();
    const angularJson = JSON.parse(arrayBufferToString(content));

    // Verify that the build target has the merged option
    expect(angularJson.projects.lib1.architect.build.options.project).toEqual(
      'libs/lib1/ng-package.json'
    );
  });

  it('should resolve tokens in merged target defaults', async () => {
    const { NxScopeHostUsedForWrappedSchematics } = require('./ngcli-adapter');
    const tree = createTreeWithEmptyWorkspace();
    const projectConfig = {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/angular:package',
          options: {},
        },
      },
    };
    addProjectConfiguration(tree, 'lib1', projectConfig as any);

    // Mock nx.json with target defaults containing tokens
    const nxJsonUtils = require('../generators/utils/nx-json');
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      targetDefaults: {
        build: {
          options: {
            project: '{projectRoot}/ng-package.json',
          },
        },
      },
    });

    // Mock isAngularPluginInstalled to return true so the adapter logic triggers
    const angularJsonUtils = require('./angular-json');
    jest
      .spyOn(angularJsonUtils, 'isAngularPluginInstalled')
      .mockReturnValue(true);

    const host = new NxScopeHostUsedForWrappedSchematics(tree.root, tree);

    // Read angular.json which should trigger the merging and token resolution
    const content = await host.read('angular.json').toPromise();
    const angularJson = JSON.parse(arrayBufferToString(content));

    // Verify that the build target has the merged option with resolved token
    expect(angularJson.projects.lib1.architect.build.options.project).toEqual(
      'libs/lib1/ng-package.json'
    );
  });

  it('should handle target without executor', async () => {
    const { NxScopeHostUsedForWrappedSchematics } = require('./ngcli-adapter');
    const tree = createTreeWithEmptyWorkspace();
    const projectConfig = {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          // No executor
          options: {},
        },
      },
    };
    addProjectConfiguration(tree, 'lib1', projectConfig as any);

    const nxJsonUtils = require('../generators/utils/nx-json');
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      targetDefaults: {
        build: {
          options: {
            project: '{projectRoot}/ng-package.json',
          },
        },
      },
    });

    const angularJsonUtils = require('./angular-json');
    jest
      .spyOn(angularJsonUtils, 'isAngularPluginInstalled')
      .mockReturnValue(true);

    const host = new NxScopeHostUsedForWrappedSchematics(tree.root, tree);
    const content = await host.read('angular.json').toPromise();
    const angularJson = JSON.parse(arrayBufferToString(content));

    // Should still merge and resolve tokens even without executor
    expect(angularJson.projects.lib1.architect.build.options.project).toEqual(
      'libs/lib1/ng-package.json'
    );
  });

  it('should merge configurations from targetDefaults', async () => {
    const { NxScopeHostUsedForWrappedSchematics } = require('./ngcli-adapter');
    const tree = createTreeWithEmptyWorkspace();
    const projectConfig = {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/angular:package',
          options: {},
        },
      },
    };
    addProjectConfiguration(tree, 'lib1', projectConfig as any);

    const nxJsonUtils = require('../generators/utils/nx-json');
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue({
      targetDefaults: {
        build: {
          options: {
            project: '{projectRoot}/ng-package.json',
          },
          configurations: {
            production: {
              tsConfig: '{projectRoot}/tsconfig.lib.prod.json',
            },
          },
        },
      },
    });

    const angularJsonUtils = require('./angular-json');
    jest
      .spyOn(angularJsonUtils, 'isAngularPluginInstalled')
      .mockReturnValue(true);

    const host = new NxScopeHostUsedForWrappedSchematics(tree.root, tree);
    const content = await host.read('angular.json').toPromise();
    const angularJson = JSON.parse(arrayBufferToString(content));

    // Verify configurations are merged and tokens resolved
    expect(
      angularJson.projects.lib1.architect.build.configurations.production
        .tsConfig
    ).toEqual('libs/lib1/tsconfig.lib.prod.json');
  });

  it('should handle missing nx.json gracefully', async () => {
    const { NxScopeHostUsedForWrappedSchematics } = require('./ngcli-adapter');
    const tree = createTreeWithEmptyWorkspace();
    const projectConfig = {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/angular:package',
          options: {
            project: '{projectRoot}/ng-package.json',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'lib1', projectConfig as any);

    const nxJsonUtils = require('../generators/utils/nx-json');
    jest.spyOn(nxJsonUtils, 'readNxJson').mockReturnValue(null);

    const angularJsonUtils = require('./angular-json');
    jest
      .spyOn(angularJsonUtils, 'isAngularPluginInstalled')
      .mockReturnValue(true);

    const host = new NxScopeHostUsedForWrappedSchematics(tree.root, tree);
    const content = await host.read('angular.json').toPromise();
    const angularJson = JSON.parse(arrayBufferToString(content));

    // Should still resolve tokens in project options
    expect(angularJson.projects.lib1.architect.build.options.project).toEqual(
      'libs/lib1/ng-package.json'
    );
  });

  // Note: When mergeTargetDefaultWithTargetDefinition is called with an empty sourceMap ({}),
  // the merge behavior depends on targetDefaultShouldBeApplied which may allow defaults
  // to override project-specific values in certain scenarios. This is consistent with
  // Nx's merge semantics when no source tracking is available.
});
