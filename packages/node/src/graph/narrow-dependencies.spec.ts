import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CreateDependenciesContext } from '@nx/devkit';
import { detectBundlersForProject } from './bundlers';
import { narrowDependencies } from './narrow-dependencies';
import { normalizeOptions } from './options';
import type { RawDependency } from './types';

describe('@nx/node graph narrowing', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-node-graph-'));

    mkdirSync(join(workspaceRoot, 'apps/app/src'), { recursive: true });
    mkdirSync(join(workspaceRoot, 'libs/side-effect-free/src'), {
      recursive: true,
    });
    mkdirSync(join(workspaceRoot, 'libs/side-effectful/src'), {
      recursive: true,
    });

    writeFileSync(
      join(workspaceRoot, 'tsconfig.base.json'),
      JSON.stringify(
        {
          compilerOptions: {
            paths: {
              '@fixtures/side-effect-free': [
                'libs/side-effect-free/src/index.ts',
              ],
              '@fixtures/side-effectful': ['libs/side-effectful/src/index.ts'],
            },
          },
        },
        null,
        2
      )
    );

    writeFileSync(
      join(workspaceRoot, 'libs/side-effect-free/package.json'),
      JSON.stringify(
        {
          name: '@fixtures/side-effect-free',
          sideEffects: false,
        },
        null,
        2
      )
    );

    writeFileSync(
      join(workspaceRoot, 'libs/side-effectful/package.json'),
      JSON.stringify(
        {
          name: '@fixtures/side-effectful',
          sideEffects: true,
        },
        null,
        2
      )
    );
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('removes an unused import edge to a side-effect-free target', async () => {
    writeFileSync(
      join(workspaceRoot, 'apps/app/src/main.ts'),
      "import { unusedValue } from '@fixtures/side-effect-free';\nconsole.log('hello');\n"
    );

    const deps: RawDependency[] = [
      {
        source: 'app',
        target: 'side-effect-free',
        type: 'static',
        sourceFile: 'apps/app/src/main.ts',
      },
    ];

    const narrowed = await narrowDependencies(
      deps,
      mockContext(workspaceRoot),
      normalizeOptions({ mode: 'semantic' })
    );

    expect(narrowed).toHaveLength(0);
  });

  it('filters out package.json-sourced edges', async () => {
    writeFileSync(
      join(workspaceRoot, 'apps/app/src/main.ts'),
      "import { usedValue } from '@fixtures/side-effect-free';\nconsole.log(usedValue);\n"
    );

    const deps: RawDependency[] = [
      {
        source: 'app',
        target: 'side-effect-free',
        type: 'static',
        sourceFile: 'apps/app/src/main.ts',
      },
      {
        source: 'app',
        target: 'side-effect-free',
        type: 'static',
        sourceFile: 'apps/app/package.json',
      },
    ];

    const narrowed = await narrowDependencies(
      deps,
      mockContext(workspaceRoot),
      normalizeOptions({ mode: 'semantic' })
    );

    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].sourceFile).toBe('apps/app/src/main.ts');
  });

  it('removes re-export edge when no consumer uses re-exported symbols', async () => {
    mkdirSync(join(workspaceRoot, 'libs/lib-a/src'), { recursive: true });

    writeFileSync(
      join(workspaceRoot, 'libs/lib-a/package.json'),
      JSON.stringify({ name: '@fixtures/lib-a', sideEffects: false }, null, 2)
    );

    writeFileSync(
      join(workspaceRoot, 'libs/lib-a/src/index.ts'),
      "export const ownValue = 1;\nexport { unusedReexport } from '@fixtures/side-effect-free';\n"
    );

    writeFileSync(
      join(workspaceRoot, 'libs/side-effect-free/src/index.ts'),
      "export const unusedReexport = 'hello';\n"
    );

    writeFileSync(
      join(workspaceRoot, 'apps/app/src/main.ts'),
      "import { ownValue } from '@fixtures/lib-a';\nconsole.log(ownValue);\n"
    );

    writeFileSync(
      join(workspaceRoot, 'tsconfig.base.json'),
      JSON.stringify(
        {
          compilerOptions: {
            paths: {
              '@fixtures/side-effect-free': [
                'libs/side-effect-free/src/index.ts',
              ],
              '@fixtures/side-effectful': ['libs/side-effectful/src/index.ts'],
              '@fixtures/lib-a': ['libs/lib-a/src/index.ts'],
            },
          },
        },
        null,
        2
      )
    );

    const deps: RawDependency[] = [
      {
        source: 'app',
        target: 'lib-a',
        type: 'static',
        sourceFile: 'apps/app/src/main.ts',
      },
      {
        source: 'lib-a',
        target: 'side-effect-free',
        type: 'static',
        sourceFile: 'libs/lib-a/src/index.ts',
      },
    ];

    const baseContext = mockContext(workspaceRoot);
    const narrowed = await narrowDependencies(
      deps,
      {
        ...baseContext,
        projects: {
          ...baseContext.projects,
          'lib-a': {
            name: 'lib-a',
            root: 'libs/lib-a',
            sourceRoot: 'libs/lib-a/src',
            projectType: 'library',
            targets: {},
          },
        },
      } as CreateDependenciesContext,
      normalizeOptions({ mode: 'semantic' })
    );

    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].source).toBe('app');
    expect(narrowed[0].target).toBe('lib-a');
  });

  it('detects bundlers from executor names', () => {
    const detected = detectBundlersForProject({
      root: 'apps/app',
      targets: {
        build: { executor: '@nx/esbuild:esbuild' },
        bundle: { executor: '@nx/webpack:webpack' },
        bundleVite: { executor: '@nx/vite:build' },
      },
    });

    expect(detected.sort()).toEqual(['esbuild', 'vite', 'webpack']);
  });
});

function mockContext(workspaceRoot: string): CreateDependenciesContext {
  return {
    workspaceRoot,
    externalNodes: {},
    nxJsonConfiguration: {},
    fileMap: {
      projectFileMap: {},
      nonProjectFiles: [],
    },
    filesToProcess: {
      projectFileMap: {},
      nonProjectFiles: [],
    },
    projects: {
      app: {
        name: 'app',
        root: 'apps/app',
        sourceRoot: 'apps/app/src',
        projectType: 'application',
        targets: {
          build: { executor: '@nx/esbuild:esbuild' },
        },
      },
      'side-effect-free': {
        name: 'side-effect-free',
        root: 'libs/side-effect-free',
        sourceRoot: 'libs/side-effect-free/src',
        projectType: 'library',
        targets: {},
      },
      'side-effectful': {
        name: 'side-effectful',
        root: 'libs/side-effectful',
        sourceRoot: 'libs/side-effectful/src',
        projectType: 'library',
        targets: {},
      },
    },
  } as CreateDependenciesContext;
}