import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, writeJsonFile } from '@nx/devkit';
import {
  createLockFile,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
  writePrunedPnpmInstallSettings,
} from '@nx/js';
import { viteBuildExecutor } from './build.impl';
import { ViteBuildExecutorOptions } from './schema';

jest.mock('../../utils/deprecation', () => ({
  warnViteBuildExecutorDeprecation: jest.fn(),
}));

jest.mock('../../utils/executor-utils', () => ({
  createBuildableTsConfig: jest.fn(() => 'apps/my-app/tsconfig.json'),
  validateTypes: jest.fn(),
  loadViteDynamicImport: jest.fn().mockResolvedValue({
    mergeConfig: (a: any, b: any) => ({ ...a, ...b }),
    build: jest.fn().mockResolvedValue({ output: [{ fileName: 'main.js' }] }),
    resolveConfig: jest
      .fn()
      .mockResolvedValue({ root: undefined, plugins: [], build: {} }),
    createBuilder: undefined,
  }),
}));

jest.mock('../../utils/options-utils', () => ({
  getProjectTsConfigPath: jest.fn(() => undefined),
  normalizeViteConfigFilePath: jest.fn(() => undefined),
}));

jest.mock('@nx/js/internal', () => ({
  isUsingTsSolutionSetup: jest.fn(() => true),
}));

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  copyAssets: jest.fn(),
  createLockFile: jest.fn(() => 'pruned-lock'),
  createPackageJson: jest.fn(() => manifest),
  getLockFileName: jest.fn(() => 'pnpm-lock.yaml'),
  getWorkspacePackagesFromGraph: jest.fn(() => new Map()),
  rewritePrunedLocalPathSpecifiers: jest.fn(),
  validatePrunedLocalPathClosure: jest.fn(),
  writePrunedPnpmInstallSettings: jest.fn(),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
  writeJsonFile: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => false),
}));

// createPackageJson is mocked to always return this, so builtPackageJson
// in the executor is the same object across tests.
let manifest: { name: string; version: string; type?: string };

describe('viteBuildExecutor - lockfile generation wiring', () => {
  const context = {
    root: '/root',
    projectName: 'my-app',
    targetName: 'build',
    cwd: '/root',
    isVerbose: false,
    projectGraph: {
      nodes: {
        'my-app': {
          type: 'app',
          name: 'my-app',
          data: { root: 'apps/my-app', targets: {} },
        },
      },
      externalNodes: {},
      dependencies: {},
    },
    projectsConfigurations: {
      version: 2,
      projects: { 'my-app': { root: 'apps/my-app' } },
    },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;

  const options: Record<string, any> & ViteBuildExecutorOptions = {
    outputPath: 'dist/apps/my-app',
    generatePackageJson: true,
    skipTypeCheck: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    manifest = { name: 'my-app', version: '1.0.0' };
  });

  async function runExecutor() {
    for await (const _ of viteBuildExecutor(options, context)) {
      // drain the generator
    }
  }

  it('rewrites local-path specifiers and validates the link: closure for pnpm', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');

    await runExecutor();

    expect(rewritePrunedLocalPathSpecifiers).toHaveBeenCalledWith(
      manifest,
      'apps/my-app',
      '/root',
      new Set()
    );
    // pnpm re-resolves local-path specifiers on install, so the rewrite must
    // land before the manifest and lockfile are written.
    const rewriteOrder = (rewritePrunedLocalPathSpecifiers as jest.Mock).mock
      .invocationCallOrder[0];
    expect(rewriteOrder).toBeLessThan(
      (writeJsonFile as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(rewriteOrder).toBeLessThan(
      (createLockFile as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(validatePrunedLocalPathClosure).toHaveBeenCalledWith(
      manifest,
      '/root',
      'pruned-lock'
    );
    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      expect.any(String),
      '/root',
      'pruned-lock',
      { includeLocalPathArtifacts: true }
    );
  });

  it('skips the link: validation on the root-lockfile fallback', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    (createLockFile as jest.Mock).mockImplementation(
      (_manifest, _graph, _pm, opts) => {
        opts?.onPruneFallback?.(new Error('prune failed'));
        return 'root-lock';
      }
    );

    await runExecutor();

    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      expect.any(String),
      '/root',
      'root-lock',
      { includeLocalPathArtifacts: false }
    );
  });

  it('leaves the manifest untouched for npm', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');

    await runExecutor();

    expect(rewritePrunedLocalPathSpecifiers).not.toHaveBeenCalled();
    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(writePrunedPnpmInstallSettings).not.toHaveBeenCalled();
  });
});
