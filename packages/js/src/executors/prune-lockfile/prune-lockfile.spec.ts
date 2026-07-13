import { type ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { getCatalogManager } from '@nx/devkit/internal';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { type PackageJson } from 'nx/src/utils/package-json';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getWorkspacePackagesFromGraph } from 'nx/src/plugins/js/utils/get-workspace-packages-from-graph';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { createPrunedLockfile } from 'nx/src/plugins/js/lock-file/lock-file';
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
  createPrunedLockfile: jest.fn(() => ({
    lockFileContent: '{}',
    pruned: true,
  })),
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

  it('strips the pruned manifest pnpm config so a standalone install matches the lockfile', async () => {
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
    // The pruned lockfile bakes resolution-time config into its snapshots, so the
    // manifest must drop it or pnpm aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
    expect(generated.pnpm).toBeUndefined();
    expect(generated.dependencies).toEqual({ lodash: '^4.17.21' });
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

// The pnpm 11 gate has no e2e coverage: generated e2e workspaces run corepack's
// default pnpm (~9.x), so the `pnpmMajor === 11` branch never fires there. These
// unit tests are the only guard on the emitted settings-only pnpm-workspace.yaml.
describe('pruneLockfileExecutor - pnpm 11 install settings', () => {
  const mockGetWorkspacePackages =
    getWorkspacePackagesFromGraph as jest.MockedFunction<
      typeof getWorkspacePackagesFromGraph
    >;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
    mockGetWorkspacePackages.mockReturnValue(new Map());
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.clearAllMocks();
  });

  // A pnpm-lock.yaml plus a pnpm packageManager field makes the executor detect
  // pnpm and pins the major getPackageManagerVersion reports, so the settings
  // gate is exercised deterministically without a real pnpm on PATH.
  function setupPnpmWorkspace(pnpmVersion: string, workspaceYaml?: string) {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({
        name: 'root',
        version: '0.0.0',
        packageManager: `pnpm@${pnpmVersion}`,
      }),
      'pnpm-lock.yaml': `lockfileVersion: '9.0'\n`,
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
      }),
    };
    if (workspaceYaml !== undefined) {
      files['pnpm-workspace.yaml'] = workspaceYaml;
    }
    tempFs.createFilesSync(files);
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

  const outputWorkspaceYaml = () =>
    join(tempFs.tempDir, 'dist', 'app', 'pnpm-workspace.yaml');

  it('re-emits allowBuilds and supportedArchitectures on pnpm 11', async () => {
    setupPnpmWorkspace(
      '11.2.2',
      [
        'packages:',
        "  - 'packages/*'",
        'overrides:',
        '  lodash: 4.17.21',
        'allowBuilds:',
        '  esbuild: true',
        'supportedArchitectures:',
        '  os:',
        '    - linux',
        '  cpu:',
        '    - x64',
        '',
      ].join('\n')
    );
    // allowBuilds is scoped to packages the pruned lockfile installs, so the
    // approved package must appear in it for the approval to carry through.
    (createPrunedLockfile as jest.Mock).mockReturnValueOnce({
      lockFileContent: [
        "lockfileVersion: '9.0'",
        'packages:',
        '  esbuild@0.21.5:',
        '    resolution: {integrity: sha512-abc}',
        '',
      ].join('\n'),
      pruned: true,
    });

    await runExecutor();

    expect(existsSync(outputWorkspaceYaml())).toBe(true);
    const content = readFileSync(outputWorkspaceYaml(), 'utf-8');
    // build-script approvals and supported architectures are carried...
    expect(content).toContain('allowBuilds:');
    expect(content).toContain('esbuild: true');
    expect(content).toContain('supportedArchitectures:');
    expect(content).toContain('linux');
    // ...but resolution-time config and the workspace `packages:` glob are not,
    // so the standalone output never enters pnpm workspace mode.
    expect(content).not.toContain('packages:');
    expect(content).not.toContain('overrides:');
  });

  it('does not emit a pnpm-workspace.yaml on pnpm 10', async () => {
    setupPnpmWorkspace('10.18.0', 'allowBuilds:\n  esbuild: true\n');

    await runExecutor();

    expect(existsSync(outputWorkspaceYaml())).toBe(false);
  });

  it('does not emit a pnpm-workspace.yaml when the workspace declares no install-time settings', async () => {
    setupPnpmWorkspace('11.2.2', 'overrides:\n  lodash: 4.17.21\n');

    await runExecutor();

    expect(existsSync(outputWorkspaceYaml())).toBe(false);
  });
});

describe('pruneLockfileExecutor - link: targets and the root lockfile fallback', () => {
  const mockGetWorkspacePackages =
    getWorkspacePackagesFromGraph as jest.MockedFunction<
      typeof getWorkspacePackagesFromGraph
    >;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('prune-lockfile');
    mockWorkspaceRoot = tempFs.tempDir;
    mockGetWorkspacePackages.mockReturnValue(new Map());
  });

  afterEach(() => {
    tempFs.cleanup();
    jest.clearAllMocks();
  });

  function setupPnpmWorkspace(linkedManifest: PackageJson) {
    tempFs.createFilesSync({
      'package.json': JSON.stringify({
        name: 'root',
        version: '0.0.0',
        packageManager: 'pnpm@11.2.2',
      }),
      'pnpm-lock.yaml': `lockfileVersion: '9.0'\n`,
      [`${PROJECT_ROOT}/package.json`]: JSON.stringify({
        name: 'app',
        version: '0.0.1',
        // Project-relative; the executor rewrites it to
        // link:local_path_modules/vendor/linked.
        dependencies: { 'linked-lib': 'link:../../vendor/linked' },
      }),
      'vendor/linked/package.json': JSON.stringify(linkedManifest),
      'vendor/linked/index.js': 'module.exports = {};',
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

  const lockfileLinkingVendor = [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .:',
    '    dependencies:',
    '      linked-lib:',
    '        specifier: link:local_path_modules/vendor/linked',
    '        version: link:local_path_modules/vendor/linked',
    '',
  ].join('\n');

  it('ships the link: target tree of an actually pruned lockfile', async () => {
    setupPnpmWorkspace({ name: 'linked-lib', version: '1.0.0' });
    (createPrunedLockfile as jest.Mock).mockReturnValueOnce({
      lockFileContent: lockfileLinkingVendor,
      pruned: true,
    });

    await runExecutor();

    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/local_path_modules/vendor/linked/index.js'
        )
      )
    ).toBe(true);
  });

  it('skips local-path shipping on the root lockfile fallback', async () => {
    // The fallback content describes the whole workspace, not the pruned app:
    // shipping its link: targets would copy unrelated source trees into the
    // output.
    setupPnpmWorkspace({
      name: 'linked-lib',
      version: '1.0.0',
      dependencies: { 'missing-dep': '^1.0.0' },
    });
    (createPrunedLockfile as jest.Mock).mockReturnValueOnce({
      lockFileContent: lockfileLinkingVendor,
      pruned: false,
    });

    await expect(runExecutor()).resolves.toEqual({ success: true });

    // The fallback lockfile is still written...
    expect(
      readFileSync(join(tempFs.tempDir, 'dist/app/package-lock.json'), 'utf-8')
    ).toBe(lockfileLinkingVendor);
    // ...but its link: target tree is not shipped.
    expect(
      existsSync(
        join(
          tempFs.tempDir,
          'dist/app/local_path_modules/vendor/linked/index.js'
        )
      )
    ).toBe(false);
  });
});
