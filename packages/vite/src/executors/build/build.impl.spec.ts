import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, writeJsonFile } from '@nx/devkit';
import { createPrunedLockfile, writePrunedPnpmInstallSettings } from '@nx/js';
import { writeFileSync } from 'fs';
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
  createPackageJson: jest.fn(() => manifest),
  createPrunedLockfile: jest.fn(() => ({
    lockFileContent: 'pruned-lock',
    pruned: true,
  })),
  getLockFileName: jest.fn(() => 'pnpm-lock.yaml'),
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
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'pruned-lock',
      pruned: true,
    });
  });

  async function runExecutor() {
    for await (const _ of viteBuildExecutor(options, context)) {
      // drain the generator
    }
  }

  it('creates the pruned pnpm lockfile before the manifest is written', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');

    await runExecutor();

    expect(createPrunedLockfile).toHaveBeenCalledWith(
      manifest,
      context.projectGraph,
      'apps/my-app',
      '/root',
      'pnpm'
    );
    // createPrunedLockfile relocates the manifest's local-path specifiers, so
    // the manifest must be written after it.
    expect(
      (createPrunedLockfile as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((writeJsonFile as jest.Mock).mock.invocationCallOrder[0]);
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('pnpm-lock.yaml'),
      'pruned-lock',
      { encoding: 'utf-8' }
    );
    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      expect.any(String),
      '/root',
      'pruned-lock',
      { includeLocalPathArtifacts: true }
    );
  });

  it('ships the root-lockfile fallback without its local-path artifacts', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'root-lock',
      pruned: false,
    });

    await runExecutor();

    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      expect.any(String),
      '/root',
      'root-lock',
      { includeLocalPathArtifacts: false }
    );
  });

  it('writes no pnpm install settings for npm', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'npm-lock',
      pruned: true,
    });

    await runExecutor();

    expect(createPrunedLockfile).toHaveBeenCalledWith(
      manifest,
      context.projectGraph,
      'apps/my-app',
      '/root',
      'npm'
    );
    expect(writePrunedPnpmInstallSettings).not.toHaveBeenCalled();
  });
});
