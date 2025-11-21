import * as devkit from '@nx/devkit';
import { readJson, writeJson, type ProjectGraph, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-redundant-ts-project-references';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(() => Promise.resolve(projectGraph)),
  formatFiles: jest.fn(() => Promise.resolve()),
}));

describe('remove-redundant-ts-project-references migration', () => {
  let tree: Tree;

  function addProject(
    name: string,
    dependencies: string[] = [],
    extraRuntimeTsConfigs: string[] = [],
    root: string = `packages/${name}`
  ) {
    projectGraph.nodes[name] = {
      name,
      type: 'lib',
      data: { root },
    };
    projectGraph.dependencies[name] = dependencies.map((dep) => ({
      type: 'static',
      source: name,
      target: dep,
    }));
    writeJson(tree, `${root}/tsconfig.json`, {
      compilerOptions: {
        composite: true,
      },
    });
    for (const runtimeTsConfigFileName of extraRuntimeTsConfigs) {
      writeJson(tree, `${root}/${runtimeTsConfigFileName}`, {
        compilerOptions: {
          composite: true,
        },
      });
    }
    writeJson(tree, `${root}/package.json`, {
      name: name,
      version: '0.0.0',
      dependencies: dependencies.reduce(
        (acc, dep) => ({ ...acc, [dep]: '0.0.0' }),
        {}
      ),
    });
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };

    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());

    writeJson(tree, 'nx.json', {
      plugins: ['@nx/js/typescript'],
    });

    // Setup TS solution: package manager workspaces + tsconfig.base.json + tsconfig.json
    writeJson(tree, 'package.json', {
      name: 'test-workspace',
      workspaces: ['packages/*'],
    });

    writeJson(tree, 'tsconfig.base.json', {
      compilerOptions: {
        composite: true,
      },
    });

    writeJson(tree, 'tsconfig.json', {
      extends: './tsconfig.base.json',
      compileOnSave: false,
      files: [],
      references: [],
    });
  });

  it('should remove redundant references from tsconfig.json when tsconfig.lib.json exists', async () => {
    // Setup: Two projects where lib2 depends on lib1
    // lib1 has a tsconfig.lib.json (runtime tsconfig)
    // Before migration, both tsconfig.json and tsconfig.lib.json have references
    addProject('lib1', [], ['tsconfig.lib.json']);
    addProject('lib2', ['lib1'], ['tsconfig.lib.json']);

    // Simulate old behavior: both tsconfig.json and tsconfig.lib.json have references
    writeJson(tree, 'packages/lib2/tsconfig.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1' }],
    });
    writeJson(tree, 'packages/lib2/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1/tsconfig.lib.json' }],
    });

    await migration(tree);

    // After migration: tsconfig.json should NOT have external references
    const tsconfig = readJson(tree, 'packages/lib2/tsconfig.json');
    expect(tsconfig.references).toEqual([]);

    // tsconfig.lib.json should still have the references
    const tsconfigLib = readJson(tree, 'packages/lib2/tsconfig.lib.json');
    expect(tsconfigLib.references).toEqual([
      { path: '../lib1/tsconfig.lib.json' },
    ]);
  });

  it('should handle multiple runtime tsconfig files (tsconfig.lib.json and tsconfig.app.json)', async () => {
    addProject('lib1', [], ['tsconfig.lib.json']);
    addProject('app1', ['lib1'], ['tsconfig.lib.json', 'tsconfig.app.json']);

    // Simulate old behavior
    writeJson(tree, 'packages/app1/tsconfig.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1' }],
    });
    writeJson(tree, 'packages/app1/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1/tsconfig.lib.json' }],
    });
    writeJson(tree, 'packages/app1/tsconfig.app.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1/tsconfig.lib.json' }],
    });

    await migration(tree);

    // tsconfig.json should NOT have external references
    const tsconfig = readJson(tree, 'packages/app1/tsconfig.json');
    expect(tsconfig.references).toEqual([]);

    // Runtime tsconfigs should have references
    const tsconfigLib = readJson(tree, 'packages/app1/tsconfig.lib.json');
    expect(tsconfigLib.references).toBeDefined();
    const tsconfigApp = readJson(tree, 'packages/app1/tsconfig.app.json');
    expect(tsconfigApp.references).toBeDefined();
  });

  it('should handle projects with multiple dependencies', async () => {
    addProject('lib1', [], ['tsconfig.lib.json']);
    addProject('lib2', [], ['tsconfig.lib.json']);
    addProject('lib3', ['lib1', 'lib2'], ['tsconfig.lib.json']);

    // Simulate old behavior
    writeJson(tree, 'packages/lib3/tsconfig.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1' }, { path: '../lib2' }],
    });
    writeJson(tree, 'packages/lib3/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [
        { path: '../lib1/tsconfig.lib.json' },
        { path: '../lib2/tsconfig.lib.json' },
      ],
    });

    await migration(tree);

    // tsconfig.json should NOT have external references
    const tsconfig = readJson(tree, 'packages/lib3/tsconfig.json');
    expect(tsconfig.references).toEqual([]);

    // tsconfig.lib.json should have all references
    const tsconfigLib = readJson(tree, 'packages/lib3/tsconfig.lib.json');
    expect(tsconfigLib.references).toEqual([
      { path: '../lib1/tsconfig.lib.json' },
      { path: '../lib2/tsconfig.lib.json' },
    ]);
  });

  it('should keep references in tsconfig.json when no runtime tsconfig exists', async () => {
    // Projects without runtime tsconfigs should keep references in tsconfig.json
    addProject('lib1');
    addProject('lib2', ['lib1']);

    await migration(tree);

    // tsconfig.json should have references (legacy behavior)
    const tsconfig = readJson(tree, 'packages/lib2/tsconfig.json');
    expect(tsconfig.references).toEqual([{ path: '../lib1' }]);
  });

  it('should handle projects with no dependencies', async () => {
    addProject('standalone-lib');

    await migration(tree);

    const tsconfig = readJson(tree, 'packages/standalone-lib/tsconfig.json');
    expect(tsconfig.references).toBeUndefined();
  });

  it('should handle workspace with both types of projects', async () => {
    // lib1: no runtime tsconfig
    // lib2: has runtime tsconfig, depends on lib1
    // lib3: no runtime tsconfig, depends on lib1
    addProject('lib1');
    addProject('lib2', ['lib1'], ['tsconfig.lib.json']);
    addProject('lib3', ['lib1']);

    // Simulate old behavior for lib2
    writeJson(tree, 'packages/lib2/tsconfig.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1' }],
    });
    writeJson(tree, 'packages/lib2/tsconfig.lib.json', {
      compilerOptions: {
        composite: true,
      },
      references: [{ path: '../lib1/tsconfig.json' }],
    });

    await migration(tree);

    // lib1: should have no references (no dependencies)
    const lib1Tsconfig = readJson(tree, 'packages/lib1/tsconfig.json');
    expect(lib1Tsconfig.references).toBeUndefined();

    // lib2: tsconfig.json should NOT have external references (has runtime tsconfig)
    const lib2Tsconfig = readJson(tree, 'packages/lib2/tsconfig.json');
    expect(lib2Tsconfig.references).toEqual([]);
    const lib2TsconfigLib = readJson(tree, 'packages/lib2/tsconfig.lib.json');
    expect(lib2TsconfigLib.references).toBeDefined();

    // lib3: tsconfig.json SHOULD have references (no runtime tsconfig)
    const lib3Tsconfig = readJson(tree, 'packages/lib3/tsconfig.json');
    expect(lib3Tsconfig.references).toEqual([{ path: '../lib1' }]);
  });

  it('should not error when projects have no package.json dependencies', async () => {
    addProject('lib1', [], ['tsconfig.lib.json']);
    addProject('lib2', [], ['tsconfig.lib.json']);

    // Manually remove dependencies from package.json
    writeJson(tree, 'packages/lib2/package.json', {
      name: 'lib2',
      version: '0.0.0',
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should not error when tsconfig.json does not have composite: true', async () => {
    addProject('lib1');
    addProject('lib2', ['lib1'], ['tsconfig.lib.json']);

    // Remove composite from lib1
    writeJson(tree, 'packages/lib1/tsconfig.json', {
      compilerOptions: {},
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should handle empty workspace', async () => {
    // Just the root tsconfig
    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should preserve internal project references', async () => {
    addProject('lib1', [], ['tsconfig.lib.json', 'tsconfig.spec.json']);

    // Add internal references (within same project)
    writeJson(tree, 'packages/lib1/tsconfig.json', {
      compilerOptions: {
        composite: true,
      },
      references: [
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
      ],
    });

    await migration(tree);

    // Internal references should be preserved
    const tsconfig = readJson(tree, 'packages/lib1/tsconfig.json');
    expect(tsconfig.references).toEqual([
      { path: './tsconfig.lib.json' },
      { path: './tsconfig.spec.json' },
    ]);
  });

  describe('skip migration when not using TS solution setup', () => {
    it('should skip when no tsconfig.json exists', async () => {
      tree.delete('tsconfig.json');
      addProject('lib1', [], ['tsconfig.lib.json']);

      await expect(migration(tree)).resolves.not.toThrow();
    });

    it('should skip when no tsconfig.base.json exists', async () => {
      tree.delete('tsconfig.base.json');
      writeJson(tree, 'tsconfig.json', {
        compilerOptions: {
          composite: true,
        },
      });
      addProject('lib1', [], ['tsconfig.lib.json']);

      await expect(migration(tree)).resolves.not.toThrow();

      // Verify no changes were made
      const tsconfig = readJson(tree, 'packages/lib1/tsconfig.json');
      expect(tsconfig).toEqual({
        compilerOptions: {
          composite: true,
        },
      });
    });

    it('should skip when not using package manager workspaces', async () => {
      // Remove package.json workspaces
      writeJson(tree, 'package.json', {
        name: 'test-workspace',
      });
      addProject('lib1', [], ['tsconfig.lib.json']);

      await expect(migration(tree)).resolves.not.toThrow();
    });
  });
});
