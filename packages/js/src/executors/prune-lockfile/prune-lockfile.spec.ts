import type { MockedFunction } from 'vitest';
import { type ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  generatePrunedDeployOutput,
  getCatalogManager,
  getWorkspacePackagesFromGraph,
  type PackageJson,
} from '@nx/devkit/internal';
import pruneLockfileExecutor, {
  resolveCatalogReferences,
} from './prune-lockfile';

// The executor reads `workspaceRoot` from `@nx/devkit`, which is captured at
// module load and isn't updated by `TempFs.setWorkspaceRoot`. Point it at the
// per-test temp dir via a getter; everything else stays real.
let mockWorkspaceRoot = '';
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  get workspaceRoot() {
    return mockWorkspaceRoot;
  },
}));

vi.mock('@nx/devkit/internal', async () => ({
  ...(await vi.importActual<any>('@nx/devkit/internal')),
  getCatalogManager: vi.fn(),
}));

// The real entry point reads the workspace's own root lockfile, which no temp
// fixture provides; stub it with the contract the executor depends on.
vi.mock('nx/src/plugins/js/lock-file/lock-file', async () => {
  const { stripPrunedLockfilePnpmConfig } = await vi.importActual<any>(
    'nx/src/plugins/js/lock-file/pruned-output'
  );
  return {
    ...(await vi.importActual<any>('nx/src/plugins/js/lock-file/lock-file')),
    generatePrunedDeployOutput: vi.fn((packageJson) => {
      // a successful prune strips the manifest's baked pnpm config, and the
      // executor writes the manifest afterwards
      stripPrunedLockfilePnpmConfig(packageJson);
    }),
  };
});
vi.mock(
  'nx/src/plugins/js/utils/get-workspace-packages-from-graph',
  async () => ({
    ...(await vi.importActual<any>(
      'nx/src/plugins/js/utils/get-workspace-packages-from-graph'
    )),
    getWorkspacePackagesFromGraph: vi.fn(() => new Map()),
  })
);

const PROJECT_ROOT = 'apps/app';

describe('pruneLockfileExecutor - allowScripts', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.clearAllMocks();
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

  it('generates the deploy output before writing the manifest', async () => {
    setupWorkspace(
      { name: 'root', version: '0.0.0' },
      { name: 'app', version: '0.0.1' }
    );

    await runExecutor();

    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'app' }),
      expect.objectContaining({ nodes: expect.any(Object) }),
      PROJECT_ROOT,
      {
        outputDirectory: join(tempFs.tempDir, 'dist/app'),
        packageManager: 'npm',
        workspaceRoot: tempFs.tempDir,
      }
    );
  });

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

describe('pruneLockfileExecutor - npm overrides', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.clearAllMocks();
  });

  async function prune(
    rootPackageJson: Partial<PackageJson>,
    projectPackageJson: Partial<PackageJson>,
    lockFileName = 'package-lock.json'
  ): Promise<PackageJson> {
    tempFs.createFilesSync({
      'package.json': JSON.stringify(rootPackageJson),
      [lockFileName]:
        lockFileName === 'package-lock.json'
          ? JSON.stringify({ name: 'root', lockfileVersion: 3 })
          : '',
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify(projectPackageJson),
    });
    tempFs.createDirSync('dist/app');
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
    return JSON.parse(
      readFileSync(join(tempFs.tempDir, 'dist', 'app', 'package.json'), 'utf-8')
    );
  }

  it('takes the root overrides, which npm applied, over the project ones it ignored', async () => {
    const packageJson = await prune(
      {
        name: 'root',
        overrides: { ms: '2.1.3', express: { 'body-parser': '1.20.3' } },
      },
      {
        name: 'app',
        dependencies: { express: '^4.21.0' },
        overrides: { nanoid: '5.1.16' },
      }
    );

    expect(packageJson.overrides).toEqual({
      ms: '2.1.3',
      express: { 'body-parser': '1.20.3' },
    });
  });

  it('sets a direct dependency to the override npm resolved it with', async () => {
    const packageJson = await prune(
      { name: 'root', overrides: { uuid: '^11.1.1' } },
      { name: 'app', dependencies: { uuid: '11.1.0' } }
    );

    expect(packageJson.dependencies).toEqual({ uuid: '^11.1.1' });
    expect(packageJson.overrides).toEqual({ uuid: '^11.1.1' });
    // the lock file is pruned for the manifest npm will install
    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      expect.objectContaining({ dependencies: { uuid: '^11.1.1' } }),
      expect.anything(),
      PROJECT_ROOT,
      expect.anything()
    );
  });

  it("uses an object override's own spec for the direct dependency", async () => {
    const packageJson = await prune(
      { name: 'root', overrides: { foo: { '.': '2.0.0', bar: '1.0.0' } } },
      { name: 'app', dependencies: { foo: '^1.0.0' } }
    );

    expect(packageJson.dependencies).toEqual({ foo: '2.0.0' });
    expect(packageJson.overrides).toEqual({
      foo: { '.': '2.0.0', bar: '1.0.0' },
    });
  });

  it('applies a name@range override only to a dependency its range intersects', async () => {
    const packageJson = await prune(
      {
        name: 'root',
        overrides: {
          'js-yaml@^4.0.0': '4.3.2',
          'debug@^2': '2.6.9',
          '@scope/foo@^1': '1.2.0',
        },
      },
      {
        name: 'app',
        dependencies: {
          'js-yaml': '^4.3.1',
          debug: '^4.3.4',
          '@scope/foo': '^1.0.0',
        },
      }
    );

    expect(packageJson.dependencies).toEqual({
      'js-yaml': '4.3.2',
      debug: '^4.3.4',
      '@scope/foo': '1.2.0',
    });
  });

  it('fails when the rewritten direct dependency matches another override', async () => {
    // npm resolves debug@^3.2.7 to 4.3.4 in the workspace, but as the root's
    // direct dependency 4.3.4 matches debug@^4, which npm rejects (EOVERRIDE)
    await expect(
      prune(
        {
          name: 'root',
          overrides: { 'debug@^3': '4.3.4', 'debug@^4': '4.3.5' },
        },
        { name: 'app', dependencies: { debug: '^3.2.7' } }
      )
    ).rejects.toThrow(
      'The root override "debug@^3" resolves the dependencies entry debug@^3.2.7 to 4.3.4. In the pruned output debug@4.3.4 is a direct dependency that the override "debug@^4" changes to 4.3.5'
    );
  });

  it('resolves $ references in the order npm looks them up', async () => {
    const packageJson = await prune(
      {
        name: 'root',
        dependencies: { ms: '2.0.0', debug: '4.3.4', uuid: '11.0.0' },
        optionalDependencies: { ms: '2.1.3' },
        devDependencies: { debug: '4.3.5' },
        peerDependencies: { uuid: '10.0.0' },
        overrides: { ms: '$ms', debug: '$debug', uuid: '$uuid' },
      },
      {
        name: 'app',
        dependencies: { ms: '^2.0.0', debug: '^4.0.0', uuid: '>=10' },
      }
    );

    // devDependencies, then optionalDependencies, dependencies, peerDependencies
    expect(packageJson.dependencies).toEqual({
      ms: '2.1.3',
      debug: '4.3.5',
      uuid: '11.0.0',
    });
  });

  it('resolves $ references against the root dependencies', async () => {
    const packageJson = await prune(
      {
        name: 'root',
        devDependencies: { typescript: '5.4.5' },
        overrides: { typescript: '$typescript' },
      },
      { name: 'app', devDependencies: { typescript: '^5.0.0' } }
    );

    expect(packageJson.devDependencies).toEqual({ typescript: '5.4.5' });
    expect(packageJson.overrides).toEqual({ typescript: '5.4.5' });
  });

  it('drops project overrides when the root has none', async () => {
    const packageJson = await prune(
      { name: 'root' },
      { name: 'app', overrides: { nanoid: '5.1.16' } }
    );

    expect(packageJson.overrides).toBeUndefined();
  });

  it('leaves the manifest alone for other package managers', async () => {
    const packageJson = await prune(
      { name: 'root', overrides: { uuid: '^11.1.1' } },
      { name: 'app', dependencies: { uuid: '11.1.0' } },
      'pnpm-lock.yaml'
    );

    expect(packageJson.dependencies).toEqual({ uuid: '11.1.0' });
    expect(packageJson.overrides).toBeUndefined();
  });
});

describe('pruneLockfileExecutor - workspace module dependencies', () => {
  const mockGetWorkspacePackages =
    getWorkspacePackagesFromGraph as MockedFunction<
      typeof getWorkspacePackagesFromGraph
    >;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
  });

  afterEach(() => {
    tempFs.cleanup();
    vi.clearAllMocks();
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

  it('rewrites workspace packages declared under optionalDependencies', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root', version: '0.0.0' }),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { lodash: '^4.17.21' },
        optionalDependencies: { '@myorg/optional-lib': 'workspace:*' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValueOnce(
      new Map([
        ['@myorg/optional-lib', { data: { root: 'libs/optional-lib' } } as any],
      ])
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
    // a workspace project under optionalDependencies -> rewritten to its copy
    expect(generated.optionalDependencies).toEqual({
      '@myorg/optional-lib': 'file:./workspace_modules/@myorg/optional-lib',
    });
    // a registry dep in dependencies is left untouched
    expect(generated.dependencies).toEqual({ lodash: '^4.17.21' });
  });

  it('rewrites workspace packages declared under devDependencies', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root', version: '0.0.0' }),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { lodash: '^4.17.21' },
        devDependencies: { '@myorg/dev-lib': 'workspace:*' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValueOnce(
      new Map([['@myorg/dev-lib', { data: { root: 'libs/dev-lib' } } as any]])
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
    // a workspace project under devDependencies -> rewritten to its copy so
    // pnpm install --frozen-lockfile does not fail on the workspace:* spec (#35425)
    expect(generated.devDependencies).toEqual({
      '@myorg/dev-lib': 'file:./workspace_modules/@myorg/dev-lib',
    });
    // a registry dep in dependencies is left untouched
    expect(generated.dependencies).toEqual({ lodash: '^4.17.21' });
  });

  it('moves workspace packages declared under peerDependencies into dependencies', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root', version: '0.0.0' }),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { lodash: '^4.17.21' },
        peerDependencies: { '@myorg/peer-lib': 'workspace:*' },
        peerDependenciesMeta: { '@myorg/peer-lib': { optional: true } },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValueOnce(
      new Map([['@myorg/peer-lib', { data: { root: 'libs/peer-lib' } } as any]])
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
    // pnpm rejects a file: spec under peerDependencies, so a peer-declared
    // workspace project is moved into dependencies (installed as a regular dep);
    // a workspace:* spec, or a file: spec left under peer, fails the install.
    expect(generated.dependencies).toEqual({
      lodash: '^4.17.21',
      '@myorg/peer-lib': 'file:./workspace_modules/@myorg/peer-lib',
    });
    expect(generated.peerDependencies).toBeUndefined();
    // the orphaned optional marker for the moved module is dropped
    expect(generated.peerDependenciesMeta).toBeUndefined();
  });

  it('moves a required (non-optional) peer workspace package into dependencies', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root', version: '0.0.0' }),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      // A required peer carries no peerDependenciesMeta entry.
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { lodash: '^4.17.21' },
        peerDependencies: { '@myorg/peer-lib': 'workspace:*' },
      }),
    });
    tempFs.createDirSync('dist/app');

    mockGetWorkspacePackages.mockReturnValueOnce(
      new Map([['@myorg/peer-lib', { data: { root: 'libs/peer-lib' } } as any]])
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
      lodash: '^4.17.21',
      '@myorg/peer-lib': 'file:./workspace_modules/@myorg/peer-lib',
    });
    expect(generated.peerDependencies).toBeUndefined();
    expect(generated.peerDependenciesMeta).toBeUndefined();
  });

  it('writes the manifest after the deploy output rewrites it', async () => {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({ name: 'root', version: '0.0.0' }),
      'package-lock.json': JSON.stringify({ name: 'root', lockfileVersion: 3 }),
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        dependencies: { lodash: '^4.17.21' },
        pnpm: { overrides: { lodash: '4.17.21' } },
      }),
    });
    tempFs.createDirSync('dist/app');

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
    // The deploy output strips the baked resolution-time config from the
    // manifest; the executor must write the manifest after that, or pnpm
    // aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
    expect(generated.pnpm).toBeUndefined();
    expect(generated.dependencies).toEqual({ lodash: '^4.17.21' });
  });
});

describe('resolveCatalogReferences', () => {
  const mockGetCatalogManager = getCatalogManager as MockedFunction<
    typeof getCatalogManager
  >;

  function makeManager(catalog: Record<string, string>) {
    return {
      isCatalogReference: (version: string) => version.startsWith('catalog:'),
      resolveCatalogReference: vi.fn(
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
