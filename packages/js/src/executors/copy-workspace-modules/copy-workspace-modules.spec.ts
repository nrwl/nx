import { type ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { getCatalogManager } from '@nx/devkit/internal';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getWorkspacePackagesFromGraph } from 'nx/src/plugins/js/utils/get-workspace-packages-from-graph';
import copyWorkspaceModules from './copy-workspace-modules';

// The executor reads `workspaceRoot` from `@nx/devkit`, captured at module load
// and not updated by TempFs. Point it at the per-test temp dir via a getter;
// everything else stays real.
let mockWorkspaceRoot = '';
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  get workspaceRoot() {
    return mockWorkspaceRoot;
  },
}));

jest.mock('@nx/devkit/internal', () => ({
  ...jest.requireActual('@nx/devkit/internal'),
  getCatalogManager: jest.fn(),
}));

jest.mock('nx/src/plugins/js/utils/get-workspace-packages-from-graph', () => ({
  ...jest.requireActual(
    'nx/src/plugins/js/utils/get-workspace-packages-from-graph'
  ),
  getWorkspacePackagesFromGraph: jest.fn(() => new Map()),
}));

const PROJECT_ROOT = 'apps/app';

describe('copyWorkspaceModules', () => {
  const mockGetWorkspacePackages =
    getWorkspacePackagesFromGraph as jest.MockedFunction<
      typeof getWorkspacePackagesFromGraph
    >;
  const mockGetCatalogManager = getCatalogManager as jest.MockedFunction<
    typeof getCatalogManager
  >;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('copy-workspace-modules');
    mockWorkspaceRoot = tempFs.tempDir;
    mockGetCatalogManager.mockReturnValue(null);
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.clearAllMocks();
  });

  function makeManager(catalog: Record<string, string>) {
    return {
      isCatalogReference: (version: string) => version.startsWith('catalog:'),
      resolveCatalogReference: jest.fn(
        (_root: string, packageName: string, _version: string) =>
          catalog[packageName] ?? null
      ),
    } as any;
  }

  // Absolute so `cpSync` resolves the module source regardless of the test cwd.
  function moduleRoot(relativePath: string): string {
    return join(tempFs.tempDir, relativePath);
  }

  async function runExecutor() {
    return copyWorkspaceModules(
      {
        buildTarget: 'app:build',
        outputPath: join(tempFs.tempDir, 'dist/app'),
      },
      {
        root: tempFs.tempDir,
        cwd: tempFs.tempDir,
        isVerbose: false,
        projectGraph: {
          nodes: {
            app: { name: 'app', type: 'app', data: { root: PROJECT_ROOT } },
          },
          dependencies: {},
          externalNodes: {},
        },
      } as unknown as ExecutorContext
    );
  }

  function readCopiedManifest(pkgName: string) {
    return JSON.parse(
      readFileSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules',
          pkgName,
          'package.json'
        ),
        'utf-8'
      )
    );
  }

  it('resolves catalog references in a copied workspace module manifest', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { lodash: 'catalog:' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } } as any],
      ])
    );
    mockGetCatalogManager.mockReturnValue(makeManager({ lodash: '^4.17.21' }));

    await runExecutor();

    // The standalone dist ships no catalog definition, so the copied manifest
    // must carry the version the workspace pinned.
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      lodash: '^4.17.21',
    });
  });

  it('throws when a copied module has an unresolvable catalog reference', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { unknown: 'catalog:' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } } as any],
      ])
    );
    mockGetCatalogManager.mockReturnValue(makeManager({}));

    await expect(runExecutor()).rejects.toThrow(
      'Could not resolve catalog reference for package unknown@catalog:.'
    );
  });

  it('leaves an unresolvable catalog reference in a copied module devDependencies alone', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { lodash: 'catalog:' },
        devDependencies: { unknown: 'catalog:' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } } as any],
      ])
    );
    mockGetCatalogManager.mockReturnValue(makeManager({ lodash: '^4.17.21' }));

    // pnpm never installs a file: dependency's devDependencies, so a catalog:
    // reference there is inert and must not abort the build even when it cannot
    // resolve. Only the installed sections are resolved.
    await runExecutor();

    const manifest = readCopiedManifest('@scope/liba');
    expect(manifest.dependencies).toEqual({ lodash: '^4.17.21' });
    expect(manifest.devDependencies).toEqual({ unknown: 'catalog:' });
  });

  it('copies a workspace module the app declares only under devDependencies', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        devDependencies: { '@scope/devlib': 'workspace:*' },
      }),
      'libs/devlib/package.json': JSON.stringify({
        name: '@scope/devlib',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map([
        ['@scope/devlib', { data: { root: moduleRoot('libs/devlib') } } as any],
      ])
    );

    await runExecutor();

    // A workspace module reachable only through devDependencies is still
    // installed by a full `pnpm install`, so it must be copied (#35425).
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/devlib/package.json'
        )
      )
    ).toBe(true);
  });

  it('copies a workspace module the app declares only under peerDependencies', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        peerDependencies: { '@scope/peerlib': 'workspace:*' },
      }),
      'libs/peerlib/package.json': JSON.stringify({
        name: '@scope/peerlib',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map([
        [
          '@scope/peerlib',
          { data: { root: moduleRoot('libs/peerlib') } } as any,
        ],
      ])
    );

    await runExecutor();

    // pnpm auto-installs an app's peers, so a workspace module reached only
    // through peerDependencies must be copied too.
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/peerlib/package.json'
        )
      )
    ).toBe(true);
  });

  it('rewrites sibling workspace-module deps to file: and copies them recursively', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { '@scope/libb': 'workspace:*' },
      }),
      'libs/libb/package.json': JSON.stringify({
        name: '@scope/libb',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
        ['@scope/libb', { data: { root: moduleRoot('libs/libb') } }],
      ])
    );

    await runExecutor();

    // The sibling reference is rewritten to the copied directory...
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      '@scope/libb': 'file:../libb',
    });
    // ...and the sibling itself is copied by the recursion.
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/libb/package.json'
        )
      )
    ).toBe(true);
  });

  it('rewrites a copied module non-workspace link: dep onto the install root', async () => {
    tempFs.createFilesSync({
      // The local-path relocation is pnpm-gated on the workspace lockfile.
      'pnpm-lock.yaml': '',
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { 'vendored-thing': 'link:../../vendor/thing' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
      ])
    );

    await runExecutor();

    // pnpm reads a non-importer manifest link: spec relative to the install
    // root, so the module-relative source ref lands deploy-root-relative.
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      'vendored-thing': 'link:vendor/thing',
    });
  });

  it('rewrites a copied module non-workspace file: dep from the module directory', async () => {
    tempFs.createFilesSync({
      'pnpm-lock.yaml': '',
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { 'vendored-thing': 'file:../../vendor/thing' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
      ])
    );

    await runExecutor();

    // Unlike link:, pnpm reads a non-importer manifest file: spec relative to
    // the package dir, so it rebases onto the copied module directory
    // (3 segments up for a scoped module).
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      'vendored-thing': 'file:../../../vendor/thing',
    });
  });

  it('moves a copied module non-workspace link: peer into dependencies', async () => {
    tempFs.createFilesSync({
      'pnpm-lock.yaml': '',
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        peerDependencies: { 'vendored-thing': 'link:../../vendor/thing' },
        peerDependenciesMeta: { 'vendored-thing': { optional: true } },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
      ])
    );

    await runExecutor();

    const manifest = readCopiedManifest('@scope/liba');
    expect(manifest.dependencies).toEqual({
      'vendored-thing': 'link:vendor/thing',
    });
    expect(manifest.peerDependencies).toBeUndefined();
    expect(manifest.peerDependenciesMeta).toBeUndefined();
  });

  it('leaves a copied module non-workspace local-path dep untouched outside pnpm', async () => {
    // An npm workspace: its prune path ships no local-path targets, so the
    // manifest must not be relocated.
    tempFs.createFilesSync({
      'package-lock.json': '{}',
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { 'vendored-thing': 'link:../../vendor/thing' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
      ])
    );

    await runExecutor();

    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      'vendored-thing': 'link:../../vendor/thing',
    });
  });

  it('leaves an absolute local-path dep in a copied module as-is with a warning', async () => {
    const { logger } = require('@nx/devkit');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    tempFs.createFilesSync({
      'pnpm-lock.yaml': '',
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { 'vendored-thing': 'link:/opt/vendor/thing' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
      ])
    );

    await runExecutor();

    // join() would silently rebase the absolute target under the module root;
    // it must stay as-is and warn instead.
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      'vendored-thing': 'link:/opt/vendor/thing',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
    warn.mockRestore();
  });

  it('copies a workspace module the app declares only under optionalDependencies', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        optionalDependencies: { '@scope/optlib': 'workspace:*' },
      }),
      'libs/optlib/package.json': JSON.stringify({
        name: '@scope/optlib',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map([
        ['@scope/optlib', { data: { root: moduleRoot('libs/optlib') } } as any],
      ])
    );

    await runExecutor();

    // A workspace module reachable only through optionalDependencies is still
    // installed by a full `pnpm install`, so it must be copied (#35425).
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/optlib/package.json'
        )
      )
    ).toBe(true);
  });

  it('rewrites an optionalDependencies sibling to file: and copies it recursively', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        optionalDependencies: { '@scope/libb': 'workspace:*' },
      }),
      'libs/libb/package.json': JSON.stringify({
        name: '@scope/libb',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
        ['@scope/libb', { data: { root: moduleRoot('libs/libb') } }],
      ])
    );

    await runExecutor();

    // A sibling declared under optionalDependencies is rewritten too...
    expect(readCopiedManifest('@scope/liba').optionalDependencies).toEqual({
      '@scope/libb': 'file:../libb',
    });
    // ...and copied by the recursion.
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/libb/package.json'
        )
      )
    ).toBe(true);
  });

  it('moves a peerDependencies sibling into dependencies as file: and copies it recursively', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        peerDependencies: { '@scope/libb': 'workspace:*' },
        peerDependenciesMeta: { '@scope/libb': { optional: true } },
      }),
      'libs/libb/package.json': JSON.stringify({
        name: '@scope/libb',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
        ['@scope/libb', { data: { root: moduleRoot('libs/libb') } }],
      ])
    );

    await runExecutor();

    // pnpm links liba's workspace peer and records it under liba's dependencies
    // in the lockfile, so the copied manifest moves it there (pnpm rejects a
    // file: spec under peerDependencies) and drops the orphaned peer marker...
    const liba = readCopiedManifest('@scope/liba');
    expect(liba.dependencies).toEqual({ '@scope/libb': 'file:../libb' });
    expect(liba.peerDependencies).toBeUndefined();
    expect(liba.peerDependenciesMeta).toBeUndefined();
    // ...and the sibling itself is copied by the recursion.
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/libb/package.json'
        )
      )
    ).toBe(true);
  });

  it('moves a required (non-optional) peerDependencies sibling into dependencies', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      // A required peer carries no peerDependenciesMeta entry.
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        peerDependencies: { '@scope/libb': 'workspace:*' },
      }),
      'libs/libb/package.json': JSON.stringify({
        name: '@scope/libb',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
        ['@scope/libb', { data: { root: moduleRoot('libs/libb') } }],
      ])
    );

    await runExecutor();

    // The required peer moves into dependencies just like the optional one; the
    // absent peerDependenciesMeta stays absent.
    const liba = readCopiedManifest('@scope/liba');
    expect(liba.dependencies).toEqual({ '@scope/libb': 'file:../libb' });
    expect(liba.peerDependencies).toBeUndefined();
    expect(liba.peerDependenciesMeta).toBeUndefined();
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/libb/package.json'
        )
      )
    ).toBe(true);
  });

  it('terminates on a workspace-module dependency cycle', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { '@scope/libb': 'workspace:*' },
      }),
      'libs/libb/package.json': JSON.stringify({
        name: '@scope/libb',
        version: '0.0.1',
        dependencies: { '@scope/liba': 'workspace:*' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
        ['@scope/libb', { data: { root: moduleRoot('libs/libb') } }],
      ])
    );

    await runExecutor();

    // The A -> B -> A cycle terminates (processedModules guards re-entry) and
    // each module's sibling reference is rewritten to the copied directory.
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      '@scope/libb': 'file:../libb',
    });
    expect(readCopiedManifest('@scope/libb').dependencies).toEqual({
      '@scope/liba': 'file:../liba',
    });
  });

  it('copies a diamond-shared workspace module reached from two paths', async () => {
    tempFs.createFilesSync({
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: {
          '@scope/liba': 'workspace:*',
          '@scope/libb': 'workspace:*',
        },
      }),
      'libs/liba/package.json': JSON.stringify({
        name: '@scope/liba',
        version: '0.0.1',
        dependencies: { '@scope/shared': 'workspace:*' },
      }),
      'libs/libb/package.json': JSON.stringify({
        name: '@scope/libb',
        version: '0.0.1',
        dependencies: { '@scope/shared': 'workspace:*' },
      }),
      'libs/shared/package.json': JSON.stringify({
        name: '@scope/shared',
        version: '0.0.1',
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValue(
      new Map<string, any>([
        ['@scope/liba', { data: { root: moduleRoot('libs/liba') } }],
        ['@scope/libb', { data: { root: moduleRoot('libs/libb') } }],
        ['@scope/shared', { data: { root: moduleRoot('libs/shared') } }],
      ])
    );

    await runExecutor();

    // Both parents rewrite the shared dep to the single copied directory.
    expect(readCopiedManifest('@scope/liba').dependencies).toEqual({
      '@scope/shared': 'file:../shared',
    });
    expect(readCopiedManifest('@scope/libb').dependencies).toEqual({
      '@scope/shared': 'file:../shared',
    });
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/workspace_modules/@scope/shared/package.json'
        )
      )
    ).toBe(true);
  });
});
