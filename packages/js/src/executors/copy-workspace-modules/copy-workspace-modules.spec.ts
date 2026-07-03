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
});
