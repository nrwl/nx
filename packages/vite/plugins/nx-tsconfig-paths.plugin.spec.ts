import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import * as ts from 'typescript';

// `var` rather than `let`: transitive imports read `workspaceRoot` while the
// module graph is still loading, before a `let` would leave its temporal dead
// zone.
var workspaceRootMock: string | undefined;
jest.mock('@nx/devkit', () => {
  const actual = jest.requireActual('@nx/devkit');
  return {
    ...actual,
    get workspaceRoot() {
      return workspaceRootMock ?? actual.workspaceRoot;
    },
  };
});

var failRootTsConfigLoad = false;
jest.mock('tsconfig-paths', () => {
  const actual = jest.requireActual('tsconfig-paths');
  return {
    ...actual,
    loadConfig: (path?: string) =>
      failRootTsConfigLoad && path?.endsWith('tsconfig.base.json')
        ? { resultType: 'failed', message: "Couldn't find tsconfig.json" }
        : actual.loadConfig(path),
  };
});

import { nxViteTsPaths } from './nx-tsconfig-paths.plugin';

describe('nxViteTsPaths', () => {
  let tempFs: TempFs;
  let originalTsConfigPath: string | undefined;

  beforeEach(() => {
    tempFs = new TempFs('nx-vite-ts-paths');
    workspaceRootMock = tempFs.tempDir;
    originalTsConfigPath = process.env.NX_TSCONFIG_PATH;
    failRootTsConfigLoad = false;
  });

  afterEach(() => {
    if (originalTsConfigPath === undefined) {
      delete process.env.NX_TSCONFIG_PATH;
    } else {
      process.env.NX_TSCONFIG_PATH = originalTsConfigPath;
    }
    tempFs.cleanup();
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

  const withProjectTsConfigOutsideWorkspace = async () => {
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
  };

  it('should defer to other resolvers when the workspace has no root-level tsconfig', async () => {
    await withProjectTsConfigOutsideWorkspace();

    await expect(resolveWith('@nope/missing')).resolves.toBeNull();
  });

  it('should defer to other resolvers when the root-level tsconfig cannot be loaded', async () => {
    await withProjectTsConfigOutsideWorkspace();
    await tempFs.createFiles({ 'tsconfig.base.json': JSON.stringify({}) });
    failRootTsConfigLoad = true;

    await expect(resolveWith('@nope/missing')).resolves.toBeNull();
  });

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
    const exact = { '@repo/exact': ['packages/exact'] };
    const wildcard = { '@repo/*': ['generic/*'] };

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

    it.each([
      ['the exact alias is declared first', { ...exact, ...wildcard }],
      ['the wildcard alias is declared first', { ...wildcard, ...exact }],
    ])('should pick the alias TypeScript picks when %s', async (_, paths) => {
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
    });
  });
});
