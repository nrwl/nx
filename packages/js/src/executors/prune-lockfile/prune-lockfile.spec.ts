import { type ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { getCatalogManager } from '@nx/devkit/internal';
import { readFileSync } from 'fs';
import { join } from 'path';
import { type PackageJson } from 'nx/src/utils/package-json';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getWorkspacePackagesFromGraph } from 'nx/src/plugins/js/utils/get-workspace-packages-from-graph';
import pruneLockfileExecutor, {
  resolveCatalogReferences,
} from './prune-lockfile';

// The executor reads `workspaceRoot` from `@nx/devkit`, which is captured at
// module load and isn't updated by `TempFs.setWorkspaceRoot`. Point it at the
// per-test temp dir via a getter; everything else stays real.
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

jest.mock('nx/src/plugins/js/lock-file/lock-file', () => ({
  ...jest.requireActual('nx/src/plugins/js/lock-file/lock-file'),
  getLockFileName: jest.fn(() => 'package-lock.json'),
  createLockFile: jest.fn(() => '{}'),
}));
jest.mock('nx/src/plugins/js/utils/get-workspace-packages-from-graph', () => ({
  ...jest.requireActual(
    'nx/src/plugins/js/utils/get-workspace-packages-from-graph'
  ),
  getWorkspacePackagesFromGraph: jest.fn(() => new Map()),
}));

const PROJECT_ROOT = 'apps/app';

describe('pruneLockfileExecutor - allowScripts', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.clearAllMocks();
  });

  function setupWorkspace(
    rootPackageJson: PackageJson,
    projectPackageJson: PackageJson
  ) {
    tempFs.createFilesSync({
      'package.json': JSON.stringify(rootPackageJson),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify(projectPackageJson),
    });
    tempFs.createDirSync('dist/app');
  }

  async function runExecutor() {
    return pruneLockfileExecutor(
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

  function readGeneratedPackageJson(): PackageJson {
    return JSON.parse(
      readFileSync(join(tempFs.tempDir, 'dist', 'app', 'package.json'), 'utf-8')
    );
  }

  it('copies the root allowScripts verbatim regardless of key shape', async () => {
    setupWorkspace(
      {
        name: 'root',
        version: '0.0.0',
        allowScripts: {
          'esbuild@0.19.0': true,
          sharp: true,
          'node-sass': false,
          '@scope/pkg@1.0.0': true,
          'org/repo#main': true,
          'git@github.com:org/repo.git': true,
          'file:../local-pkg': true,
          'https://example.com/a.tgz': true,
        },
      },
      { name: 'app', version: '0.0.1' }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toEqual({
      'esbuild@0.19.0': true,
      sharp: true,
      'node-sass': false,
      '@scope/pkg@1.0.0': true,
      'org/repo#main': true,
      'git@github.com:org/repo.git': true,
      'file:../local-pkg': true,
      'https://example.com/a.tgz': true,
    });
  });

  it('merges root and project allowScripts, with project winning on conflict', async () => {
    setupWorkspace(
      {
        name: 'root',
        version: '0.0.0',
        allowScripts: { sharp: true, esbuild: true },
      },
      { name: 'app', version: '0.0.1', allowScripts: { sharp: false } }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toEqual({
      sharp: false,
      esbuild: true,
    });
  });

  it('leaves the project allowScripts untouched when the root has none', async () => {
    setupWorkspace(
      { name: 'root', version: '0.0.0' },
      { name: 'app', version: '0.0.1', allowScripts: { foo: true } }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toEqual({ foo: true });
  });

  it('omits allowScripts when neither the root nor the project define it', async () => {
    setupWorkspace(
      { name: 'root', version: '0.0.0' },
      { name: 'app', version: '0.0.1' }
    );

    await runExecutor();

    expect(readGeneratedPackageJson().allowScripts).toBeUndefined();
  });
});

describe('pruneLockfileExecutor - workspace module dependencies', () => {
  const mockGetWorkspacePackages =
    getWorkspacePackagesFromGraph as jest.MockedFunction<
      typeof getWorkspacePackagesFromGraph
    >;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.clearAllMocks();
  });

  it('rewrites only graph workspace packages, leaving non-workspace file: deps alone', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root', version: '0.0.0' }),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: {
          '@myorg/lib': 'workspace:*',
          vendored: 'file:./vendor/vendored.tgz',
          lodash: '^4.17.21',
        },
      }),
    });
    tempFs.createDirSync('dist/app');

    // Only @myorg/lib is an actual workspace project in the graph.
    mockGetWorkspacePackages.mockReturnValueOnce(
      new Map([['@myorg/lib', { data: { root: 'libs/lib' } } as any]])
    );

    await pruneLockfileExecutor(
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

    const generated: PackageJson = JSON.parse(
      readFileSync(join(tempFs.tempDir, 'dist', 'app', 'package.json'), 'utf-8')
    );
    expect(generated.dependencies).toEqual({
      // a real workspace project -> rewritten to its copied directory
      '@myorg/lib': 'file:./workspace_modules/@myorg/lib',
      // a non-workspace local file: dep -> left untouched
      vendored: 'file:./vendor/vendored.tgz',
      // a registry dep -> left untouched
      lodash: '^4.17.21',
    });
  });
});

describe('resolveCatalogReferences', () => {
  const mockGetCatalogManager = getCatalogManager as jest.MockedFunction<
    typeof getCatalogManager
  >;

  function makeManager(catalog: Record<string, string>) {
    return {
      isCatalogReference: (version: string) => version.startsWith('catalog:'),
      resolveCatalogReference: jest.fn(
        (_root: string, packageName: string, _version: string) =>
          catalog[packageName] ?? null
      ),
    } as any;
  }

  beforeEach(() => {
    mockGetCatalogManager.mockReset();
  });

  it('should return input unchanged when no catalog manager is available', () => {
    mockGetCatalogManager.mockReturnValue(null);
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { react: 'catalog:' },
    };

    const result = resolveCatalogReferences(packageJson);

    expect(result).toBe(packageJson);
  });

  it('should resolve catalog references across all dependency sections', () => {
    mockGetCatalogManager.mockReturnValue(
      makeManager({
        react: '^18.0.0',
        zod: '^3.22.0',
        jest: '^29.0.0',
        typescript: '^5.0.0',
      })
    );
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { react: 'catalog:', lodash: '^4.17.0' },
      optionalDependencies: { zod: 'catalog:' },
      devDependencies: { jest: 'catalog:' },
      peerDependencies: { typescript: 'catalog:' },
    };

    const result = resolveCatalogReferences(packageJson);

    expect(result.dependencies).toEqual({
      react: '^18.0.0',
      lodash: '^4.17.0',
    });
    expect(result.optionalDependencies).toEqual({ zod: '^3.22.0' });
    expect(result.devDependencies).toEqual({ jest: '^29.0.0' });
    expect(result.peerDependencies).toEqual({ typescript: '^5.0.0' });
  });

  it('should preserve non-catalog version specifiers', () => {
    mockGetCatalogManager.mockReturnValue(makeManager({ react: '^18.0.0' }));
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: {
        react: 'catalog:',
        lodash: '^4.17.0',
        '@scope/pkg': 'workspace:*',
        local: 'file:./local',
      },
    };

    const result = resolveCatalogReferences(packageJson);

    expect(result.dependencies).toEqual({
      react: '^18.0.0',
      lodash: '^4.17.0',
      '@scope/pkg': 'workspace:*',
      local: 'file:./local',
    });
  });

  it('should not mutate the input package.json', () => {
    mockGetCatalogManager.mockReturnValue(makeManager({ react: '^18.0.0' }));
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { react: 'catalog:' },
    };

    const result = resolveCatalogReferences(packageJson);

    expect(packageJson.dependencies).toEqual({ react: 'catalog:' });
    expect(result).not.toBe(packageJson);
    expect(result.dependencies).not.toBe(packageJson.dependencies);
  });

  it('should throw when a catalog reference cannot be resolved', () => {
    mockGetCatalogManager.mockReturnValue(makeManager({}));
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { react: 'catalog:' },
    };

    expect(() => resolveCatalogReferences(packageJson)).toThrow(
      'Could not resolve catalog reference for package react@catalog:.'
    );
  });

  it('should handle missing dependency sections', () => {
    mockGetCatalogManager.mockReturnValue(makeManager({ react: '^18.0.0' }));
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { react: 'catalog:' },
    };

    const result = resolveCatalogReferences(packageJson);

    expect(result.dependencies).toEqual({ react: '^18.0.0' });
    expect(result.devDependencies).toBeUndefined();
    expect(result.peerDependencies).toBeUndefined();
    expect(result.optionalDependencies).toBeUndefined();
  });
});
