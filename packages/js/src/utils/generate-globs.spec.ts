import type { ProjectGraph } from '@nx/devkit';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
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
});
