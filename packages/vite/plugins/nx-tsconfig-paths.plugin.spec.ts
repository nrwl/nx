import { TempFs } from '@nx/devkit/internal-testing-utils';
import Module from 'node:module';
import { join } from 'node:path';
import * as ts from 'typescript';
import { nxViteTsPaths } from './nx-tsconfig-paths.plugin';

// The plugin reads `workspaceRoot` from `@nx/devkit`, which is captured at
// module load; `TempFs` only moves nx's own binding.
const mockRoot = vi.hoisted(() => ({ path: '' }));
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  get workspaceRoot() {
    return mockRoot.path;
  },
}));

describe('nxViteTsPaths', () => {
  let tempFs: TempFs;
  let originalTsConfigPath: string | undefined;

  // tsconfig-paths probes every `require.extensions` key. The shared setup's
  // swc-node hook adds `.ts`, which plain node (and jest's sandbox) lack.
  let savedExtensions: Record<string, unknown>;
  beforeEach(() => {
    const extensions = (Module as any)._extensions;
    savedExtensions = { ...extensions };
    for (const ext of Object.keys(extensions)) {
      if (!['.js', '.json', '.node'].includes(ext)) delete extensions[ext];
    }
    tempFs = new TempFs('nx-vite-ts-paths');
    mockRoot.path = tempFs.tempDir;
    originalTsConfigPath = process.env.NX_TSCONFIG_PATH;
  });

  afterEach(() => {
    if (originalTsConfigPath === undefined) {
      delete process.env.NX_TSCONFIG_PATH;
    } else {
      process.env.NX_TSCONFIG_PATH = originalTsConfigPath;
    }
    delete global.NX_GRAPH_CREATION;
    tempFs.cleanup();
    vi.restoreAllMocks();
    Object.assign((Module as any)._extensions, savedExtensions);
  });

  const resolveWith = async (importPath: string) => {
    const plugin = nxViteTsPaths();
    await (plugin as any).configResolved({
      root: join(tempFs.tempDir, 'app'),
      command: 'build',
      plugins: [],
    });
    return (plugin as any).resolveId(importPath);
  };

  describe('when the workspace has no root-level tsconfig', () => {
    beforeEach(async () => {
      await tempFs.createFiles({
        'external/tsconfig.json': JSON.stringify({
          compilerOptions: { baseUrl: '.', paths: { '@ext/*': ['libs/*'] } },
        }),
        'app/src/main.ts': '',
      });
      process.env.NX_TSCONFIG_PATH = join(
        tempFs.tempDir,
        'external/tsconfig.json'
      );
    });

    it('should defer to other resolvers for an unmapped import', async () => {
      await expect(resolveWith('@nope/missing')).resolves.toBeNull();
    });

    it('should resolve an alias of the project tsconfig', async () => {
      await tempFs.createFiles({ 'external/libs/foo.ts': '' });

      await expect(resolveWith('@ext/foo')).resolves.toEqual(
        join(tempFs.tempDir, 'external/libs/foo.ts')
      );
    });
  });

  // An import named after an `Object` prototype member reaches every lookup
  // keyed on the import path, and an inherited value is not a mapped path.
  it.each(['constructor', 'toString', '__proto__'])(
    'should defer to other resolvers for the unmapped import %s',
    async (importPath) => {
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: { baseUrl: '.', paths: {} },
        }),
        'app/src/main.ts': '',
      });

      await expect(resolveWith(importPath)).resolves.toBeNull();
    }
  );

  it.each(['constructor', 'toString', '__proto__'])(
    'should resolve the alias %s when the tsconfig declares it',
    async (importPath) => {
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { [importPath]: ['libs/declared'] },
          },
        }),
        'libs/declared/index.ts': '',
        'app/src/main.ts': '',
      });

      await expect(resolveWith(importPath)).resolves.toEqual(
        join(tempFs.tempDir, 'libs/declared/index.ts')
      );
    }
  );

  it('should resolve a workspace alias through the root-level tsconfig', async () => {
    await tempFs.createFiles({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@repo/util': ['libs/util/index.ts'] },
        },
      }),
      'libs/util/index.ts': '',
      'app/src/main.ts': '',
    });

    await expect(resolveWith('@repo/util')).resolves.toEqual(
      join(tempFs.tempDir, 'libs/util/index.ts')
    );
  });

  it('should substitute the wildcard of a mapped path pointing at a directory', async () => {
    await tempFs.createFiles({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@lib/*': ['packages/*/src'] },
        },
      }),
      'packages/one/src/index.ts': '',
      'app/src/main.ts': '',
    });

    await expect(resolveWith('@lib/one')).resolves.toEqual(
      join(tempFs.tempDir, 'packages/one/src/index.ts')
    );
  });

  it('should resolve paths inherited through extends against the tsconfig that declares them', async () => {
    // No `tsconfig.base.json`: the root-level lookup falls back to the
    // project tsconfig, so both resolution passes share its directory and
    // nothing masks a base taken from the leaf.
    await tempFs.createFiles({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@repo/util/*': ['libs/util/*'] } },
      }),
      'app/tsconfig.json': JSON.stringify({ extends: '../tsconfig.json' }),
      'libs/util/foo.ts': '',
      'app/src/main.ts': '',
    });

    await expect(resolveWith('@repo/util/foo')).resolves.toEqual(
      join(tempFs.tempDir, 'libs/util/foo.ts')
    );
  });

  describe('when more than one alias resolves', () => {
    // Whether a mapped path names an extension decides which pass answers:
    // `tsconfig-paths` probes for `.js`, `.json` and `.node` only, so a
    // wildcard naming one resolves there while an exact alias waits for a pass
    // that knows the configured extensions.
    const mappedPathShapes: [string, string[], string[]][] = [
      ['neither names an extension', ['packages/exact'], ['generic/*']],
      ['both name an extension', ['packages/exact/index.ts'], ['generic/*.ts']],
      [
        'only the wildcard names an extension',
        ['packages/exact'],
        ['generic/*.ts'],
      ],
      [
        'only the exact alias names an extension',
        ['packages/exact/index.ts'],
        ['generic/*'],
      ],
    ];

    const declarationOrders = mappedPathShapes.flatMap(
      ([shape, exactPaths, wildcardPaths]) => {
        const exact = { '@repo/exact': exactPaths };
        const wildcard = { '@repo/*': wildcardPaths };

        return [
          [
            `${shape} and the exact alias is declared first`,
            {
              ...exact,
              ...wildcard,
            },
          ],
          [
            `${shape} and the wildcard alias is declared first`,
            {
              ...wildcard,
              ...exact,
            },
          ],
        ] as [string, Record<string, string[]>][];
      }
    );

    const resolveWithTypeScript = (
      paths: Record<string, string[]>,
      moduleResolution: ts.ModuleResolutionKind,
      module: ts.ModuleKind
    ) =>
      ts.resolveModuleName(
        '@repo/exact',
        join(tempFs.tempDir, 'app/src/main.ts'),
        { baseUrl: tempFs.tempDir, paths, module, moduleResolution },
        ts.sys
      ).resolvedModule?.resolvedFileName;

    const expectTypeScriptsPick = async (paths: Record<string, string[]>) => {
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: { baseUrl: '.', paths },
        }),
        'packages/exact/index.ts': '',
        'generic/exact.ts': '',
        'app/src/main.ts': '',
      });
      const expected = join(tempFs.tempDir, 'packages/exact/index.ts');

      expect(
        resolveWithTypeScript(
          paths,
          ts.ModuleResolutionKind.Bundler,
          ts.ModuleKind.ESNext
        )
      ).toEqual(expected);
      expect(
        resolveWithTypeScript(
          paths,
          ts.ModuleResolutionKind.NodeNext,
          ts.ModuleKind.NodeNext
        )
      ).toEqual(expected);
      expect(
        resolveWithTypeScript(
          paths,
          ts.ModuleResolutionKind.Node10,
          ts.ModuleKind.CommonJS
        )
      ).toEqual(expected);
      await expect(resolveWith('@repo/exact')).resolves.toEqual(expected);
    };

    it.each(declarationOrders)(
      'should pick the alias TypeScript picks when %s',
      (_, paths) => expectTypeScriptsPick(paths)
    );

    it('should keep the package entry of an exact alias over an index file', async () => {
      const paths = {
        '@repo/exact': ['packages/exact'],
        '@repo/*': ['generic/*.ts'],
      };
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: { baseUrl: '.', paths },
        }),
        'packages/exact/package.json': JSON.stringify({
          exports: { '.': { import: './dist/index.js' } },
        }),
        'packages/exact/dist/index.js': '',
        'packages/exact/index.ts': '',
        'generic/exact.ts': '',
        'app/src/main.ts': '',
      });

      await expect(resolveWith('@repo/exact')).resolves.toEqual(
        join(tempFs.tempDir, 'packages/exact/dist/index.js')
      );
    });
  });

  const configResolved = (plugin: any) =>
    plugin.configResolved({ root: join(tempFs.tempDir, 'app') });

  it('should defer to other resolvers when the workspace has no tsconfig', async () => {
    await expect(resolveWith('@repo/util')).resolves.toBeNull();
  });

  it('should fail config resolution on a malformed tsconfig outside graph construction', async () => {
    await tempFs.createFiles({ 'tsconfig.base.json': '{ "compilerOptions": ' });

    await expect(configResolved(nxViteTsPaths())).rejects.toThrow(
      'is malformed'
    );
  });

  it('should parse the tsconfigs on the first import after each configResolved during graph construction', async () => {
    global.NX_GRAPH_CREATION = true;
    await tempFs.createFiles({
      'app/tsconfig.app.json': JSON.stringify({
        compilerOptions: { paths: { '@app/local': ['src/local.ts'] } },
      }),
      'app/src/local.ts': '',
    });
    const plugin: any = nxViteTsPaths();
    await configResolved(plugin);
    plugin.resolveId('@app/local');
    await tempFs.createFiles({ 'tsconfig.base.json': '{ "compilerOptions": ' });

    expect(plugin.resolveId('@app/local')).toEqual(
      join(tempFs.tempDir, 'app/src/local.ts')
    );

    await configResolved(plugin);

    // A failed parse leaves the next import to parse again.
    expect(() => plugin.resolveId('@app/local')).toThrow('is malformed');
    expect(() => plugin.resolveId('@app/local')).toThrow('is malformed');
  });
});
