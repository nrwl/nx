import type { Mock } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, writeJsonFile } from '@nx/devkit';
import { generatePrunedDeployOutput } from '@nx/js';
import { viteBuildExecutor } from './build.impl';
import { ViteBuildExecutorOptions } from './schema';

vi.mock('../../utils/deprecation', () => ({
  warnViteBuildExecutorDeprecation: vi.fn(),
}));

vi.mock('../../utils/executor-utils', () => ({
  createBuildableTsConfig: vi.fn(() => 'apps/my-app/tsconfig.json'),
  validateTypes: vi.fn(),
  loadViteDynamicImport: vi.fn().mockResolvedValue({
    mergeConfig: (a: any, b: any) => ({ ...a, ...b }),
    build: vi.fn().mockResolvedValue({ output: [{ fileName: 'main.js' }] }),
    resolveConfig: vi
      .fn()
      .mockResolvedValue({ root: undefined, plugins: [], build: {} }),
    createBuilder: undefined,
  }),
}));

vi.mock('../../utils/options-utils', () => ({
  getProjectTsConfigPath: vi.fn(() => undefined),
  normalizeViteConfigFilePath: vi.fn(() => undefined),
}));

vi.mock('@nx/js/internal', () => ({
  isUsingTsSolutionSetup: vi.fn(() => true),
}));

vi.mock('@nx/js', async () => ({
  ...(await vi.importActual<any>('@nx/js')),
  copyAssets: vi.fn(),
  createPackageJson: vi.fn(() => manifest),
  generatePrunedDeployOutput: vi.fn(),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  detectPackageManager: vi.fn(),
  writeJsonFile: vi.fn(),
}));

vi.mock('fs', async () => ({
  ...(await vi.importActual<any>('fs')),
  existsSync: vi.fn(() => false),
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
    vi.clearAllMocks();
    manifest = { name: 'my-app', version: '1.0.0' };
  });

  async function runExecutor() {
    for await (const _ of viteBuildExecutor(options, context)) {
      // drain the generator
    }
  }

  it('generates the pruned deploy output before the manifest is written', async () => {
    (detectPackageManager as Mock).mockReturnValue('pnpm');

    await runExecutor();

    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      manifest,
      context.projectGraph,
      'apps/my-app',
      {
        outputDirectory: expect.stringContaining('dist/apps/my-app'),
        packageManager: 'pnpm',
        workspaceRoot: '/root',
      }
    );
    // The deploy output rewrites the manifest's local-path specifiers, so the
    // manifest must be written after it.
    expect(
      (generatePrunedDeployOutput as Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((writeJsonFile as Mock).mock.invocationCallOrder[0]);
  });

  it('leaves the bun decision to the deploy output', async () => {
    (detectPackageManager as Mock).mockReturnValue('bun');

    await runExecutor();

    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ packageManager: 'bun' })
    );
    expect(writeJsonFile).toHaveBeenCalled();
  });
});
