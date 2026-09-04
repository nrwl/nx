import type { Mock } from 'vitest';
import { join } from 'node:path';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { createTreeWithEmptyWorkspace } from '../generators/testing-utils/create-tree-with-empty-workspace';
import { addProjectConfiguration } from '../generators/utils/project-configuration';
import { TempFs } from '../internal-testing-utils/temp-fs';
import {
  arrayBufferToString,
  restoreNxTokensInOptions,
  wrapAngularDevkitSchematic,
} from './ngcli-adapter';

vi.mock('../project-graph/project-graph', async () => ({
  ...(await vi.importActual('../project-graph/project-graph')),
  createProjectGraphAsync: () => ({
    nodes: {},
    externalNodes: {},
  }),
}));
vi.mock('../plugins/js/utils/register', async () => ({
  ...(await vi.importActual('../plugins/js/utils/register')),
  registerSourceGraphResolver: vi.fn(() => () => {}),
}));
// Resolving a local package registers the plugin transpiler; keep that out of
// the test worker.
vi.mock('../project-graph/plugins/transpiler', async () => ({
  ...(await vi.importActual('../project-graph/plugins/transpiler')),
  registerPluginTSTranspiler: vi.fn(),
  pluginTranspilerIsRegistered: () => true,
}));

describe('getWrappedWorkspaceNodeModulesArchitectHost', () => {
  let fs: TempFs;

  afterEach(() => {
    fs?.cleanup();
  });

  // Architect requires the resolved path itself, so the registration has to
  // happen inside resolveBuilder(), before the path is handed back.
  it('registers the source graph of a source-selected builder before handing its path to Architect', async () => {
    fs = new TempFs('ngcli-adapter-builders');
    fs.createFilesSync({
      'package.json': JSON.stringify({
        name: 'root',
        workspaces: ['packages/*'],
      }),
      'packages/builders/package.json': JSON.stringify({
        name: '@proj/builders',
        builders: './builders.json',
      }),
      'packages/builders/builders.json': JSON.stringify({
        builders: {
          build: { implementation: './src/build', schema: './src/schema.json' },
        },
      }),
      'packages/builders/src/build.ts': 'export default () => {};\n',
      'packages/builders/src/schema.json': JSON.stringify({ type: 'object' }),
    });
    // Fresh module state: local package lookups cache the workspace layout.
    vi.resetModules();
    const { setWorkspaceRoot } = await import('../utils/workspace-root');
    setWorkspaceRoot(fs.tempDir);
    const { registerSourceGraphResolver } =
      await import('../plugins/js/utils/register');
    (registerSourceGraphResolver as Mock).mockClear();
    const { getWrappedWorkspaceNodeModulesArchitectHost } =
      await import('./ngcli-adapter');
    const projects: Record<string, ProjectConfiguration> = {
      builders: {
        name: 'builders',
        root: 'packages/builders',
        metadata: {
          js: {
            packageName: '@proj/builders',
            packageExports: './dist/index.js',
            packageMain: 'dist/index.js',
            isInPackageManagerWorkspaces: true,
          },
        } as ProjectConfiguration['metadata'],
      },
    };

    const host = await getWrappedWorkspaceNodeModulesArchitectHost(
      {} as any,
      fs.tempDir,
      projects
    );
    const info = await host.resolveBuilder('@proj/builders:build');

    const builderPath = join(fs.tempDir, 'packages/builders/src/build.ts');
    expect(info.import).toBe(builderPath);
    expect(registerSourceGraphResolver).toHaveBeenCalledWith(
      builderPath,
      fs.tempDir,
      ['@proj/builders']
    );
  });
});

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
