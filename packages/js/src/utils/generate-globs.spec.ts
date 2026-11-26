import type { ProjectGraph } from '@nx/devkit';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const mocks = vi.hoisted(() => ({
  workspaceRoot: '',
  projectGraph: { nodes: {}, dependencies: {} } as ProjectGraph,
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  get workspaceRoot() {
    return mocks.workspaceRoot;
  },
  readCachedProjectGraph: () => mocks.projectGraph,
}));

import { createGlobPatternsForDependencies } from './generate-globs';

describe('createGlobPatternsForDependencies', () => {
  beforeEach(() => {
    mocks.workspaceRoot = mkdtempSync(join(tmpdir(), 'generate-globs-'));
    mkdirSync(join(mocks.workspaceRoot, 'apps/app/src'), { recursive: true });
    mkdirSync(join(mocks.workspaceRoot, 'libs/ui/src'), { recursive: true });
    mkdirSync(join(mocks.workspaceRoot, 'libs/config'), { recursive: true });
    mocks.projectGraph = {
      nodes: {
        app: {
          name: 'app',
          type: 'app',
          data: { root: 'apps/app', sourceRoot: 'apps/app/src' },
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: { root: 'libs/ui', sourceRoot: 'libs/ui/src' },
        },
        config: {
          name: 'config',
          type: 'lib',
          data: { root: 'libs/config', sourceRoot: 'libs/config' },
        },
      },
      dependencies: {
        app: [
          { source: 'app', target: 'ui', type: 'static' },
          { source: 'app', target: 'config', type: 'static' },
        ],
        ui: [],
        config: [],
      },
    };
  });

  afterEach(() => {
    rmSync(mocks.workspaceRoot, { recursive: true, force: true });
  });

  it('should exclude node_modules under each dependency source directory', () => {
    const globs = createGlobPatternsForDependencies(
      join(mocks.workspaceRoot, 'apps/app'),
      '/**/*.{ts,html}'
    );

    expect(globs.map((glob) => glob.replace(mocks.workspaceRoot, '<root>')))
      .toMatchInlineSnapshot(`
      [
        "<root>/libs/ui/src/**/*.{ts,html}",
        "<root>/libs/config/**/*.{ts,html}",
        "!<root>/libs/ui/src/**/node_modules/**",
        "!<root>/libs/config/**/node_modules/**",
      ]
    `);
  });

  it('should include the export subpath directories the library builder compiles when asked', () => {
    for (const dir of [
      'libs/ui/testing/src',
      'libs/ui/styles',
      'libs/ui/fixtures',
      'libs/ui/shared',
      'libs/other',
    ]) {
      mkdirSync(join(mocks.workspaceRoot, dir), { recursive: true });
    }
    writeFileSync(
      join(mocks.workspaceRoot, 'libs/ui/package.json'),
      JSON.stringify({
        exports: {
          '.': './src/index.ts',
          './testing': {
            types: './testing/src/index.d.ts',
            default: './testing/src/index.ts',
          },
          './utils': './src/utils.ts',
          './styles': './styles/index.css',
          './fixtures': null,
          './shared': './src/shared.ts',
        },
      })
    );
    // A project rooted at the sourceRoot of "ui" doesn't own its exports.
    mocks.projectGraph.nodes.nested = {
      name: 'nested',
      type: 'lib',
      data: { root: 'libs/ui/src', sourceRoot: 'libs/ui/src' },
    };
    // The scan of "config", whose sourceRoot is its root, starts in "libs".
    writeFileSync(
      join(mocks.workspaceRoot, 'libs/package.json'),
      JSON.stringify({ exports: { './other': './other/index.ts' } })
    );
    const createGlobs = (options?: {
      includeLibraryBuilderEntryPoints?: boolean;
    }) =>
      createGlobPatternsForDependencies(
        join(mocks.workspaceRoot, 'apps/app'),
        '/**/*.{ts,html}',
        options
      )
        .filter((glob) => !glob.startsWith('!'))
        .map((glob) => glob.replace(mocks.workspaceRoot, '<root>'));

    expect(
      createGlobs({ includeLibraryBuilderEntryPoints: true })
    ).toStrictEqual([
      '<root>/libs/ui/src/**/*.{ts,html}',
      '<root>/libs/ui/testing/**/*.{ts,html}',
      '<root>/libs/config/**/*.{ts,html}',
    ]);
    expect(createGlobs()).toStrictEqual([
      '<root>/libs/ui/src/**/*.{ts,html}',
      '<root>/libs/config/**/*.{ts,html}',
    ]);
  });
});
