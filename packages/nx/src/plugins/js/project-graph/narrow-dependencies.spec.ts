import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import { narrowDependencies } from './narrow-dependencies';
import {
  getJsPluginDependencyNarrowingOptions,
  normalizeDependencyNarrowingOptions,
} from './narrowing-options';
import type { RawDependency } from './types';

describe('@nx/js project graph narrowing', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-js-graph-'));

    mkdirSync(join(workspaceRoot, 'apps/app/src'), { recursive: true });
    mkdirSync(join(workspaceRoot, 'libs/side-effect-free/src'), {
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
      normalizeDependencyNarrowingOptions({ mode: 'semantic' })
    );

    expect(narrowed).toHaveLength(0);
  });

  it('reads dependency narrowing options from the @nx/js plugin config', () => {
    expect(
      getJsPluginDependencyNarrowingOptions({
        pluginsConfig: {
          '@nx/js': {
            dependencyNarrowing: {
              debug: true,
              affectedNarrowing: false,
            },
          },
        },
      } as CreateDependenciesContext['nxJsonConfiguration'])
    ).toMatchObject({
      debug: true,
      affectedNarrowing: false,
      respectSideEffects: true,
      removeTypeOnlyEdges: true,
      fallbackToStaticGraph: true,
    });
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
    },
  } as CreateDependenciesContext;
}
