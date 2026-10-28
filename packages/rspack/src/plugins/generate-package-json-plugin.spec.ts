import type { Mock } from 'vitest';
import type { ExecutorContext, ProjectGraph } from '@nx/devkit';
import { detectPackageManager } from '@nx/devkit';
import { createPackageJson, generatePrunedDeployOutput } from '@nx/js';
import { GeneratePackageJsonPlugin } from './generate-package-json-plugin';

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  detectPackageManager: vi.fn(),
}));

vi.mock('@nx/js', async () => ({
  ...(await vi.importActual<any>('@nx/js')),
  createPackageJson: vi.fn(),
  generatePrunedDeployOutput: vi.fn(),
  getHelperDependenciesFromProjectGraph: vi.fn(() => []),
  readTsConfig: vi.fn(() => ({ options: {} })),
}));

// Fake source wrapper so the plugin's `new sources.RawSource(...)` calls have
// something to construct without pulling in the real webpack sources module.
class FakeRawSource {
  constructor(private readonly content: string) {}

  source(): string {
    return this.content;
  }
}

describe('GeneratePackageJsonPlugin', () => {
  const projectGraph = {
    nodes: {
      'my-app': {
        type: 'app',
        name: 'my-app',
        data: { root: 'apps/my-app', targets: {} },
      },
    },
    externalNodes: {},
    dependencies: {},
  } as unknown as ProjectGraph;

  const context = {
    root: '/root',
    projectName: 'my-app',
    targetName: 'build',
    projectGraph,
  } as unknown as ExecutorContext;

  let packageJson: { name: string; version: string };

  beforeEach(() => {
    vi.clearAllMocks();
    packageJson = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as Mock).mockReturnValue(packageJson);
    (detectPackageManager as Mock).mockReturnValue('pnpm');
  });

  async function runPlugin(): Promise<Mock> {
    const emitAsset = vi.fn();
    let processAssetsResult: Promise<void> | undefined;
    const compilation = {
      hooks: {
        processAssets: {
          tapPromise: (_opts: unknown, fn: () => Promise<void>) => {
            processAssetsResult = fn();
          },
        },
      },
      emitAsset,
      getLogger: () => ({ warn: vi.fn() }),
    };
    const compiler = {
      webpack: {
        Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: 100 },
        sources: { RawSource: FakeRawSource },
      },
      hooks: {
        thisCompilation: {
          tap: (_name: string, fn: (compilation: unknown) => void) =>
            fn(compilation),
        },
      },
    };
    new GeneratePackageJsonPlugin(
      {
        tsConfig: '/root/apps/my-app/tsconfig.json',
        outputFileName: 'main.js',
      },
      context
    ).apply(compiler as any);
    await processAssetsResult;
    return emitAsset;
  }

  it('generates the pruned deploy output into the compilation assets', async () => {
    const emitAsset = await runPlugin();

    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      packageJson,
      projectGraph,
      'apps/my-app',
      {
        emit: expect.any(Function),
        packageManager: 'pnpm',
        workspaceRoot: '/root',
      }
    );
    const { emit } = (generatePrunedDeployOutput as Mock).mock.calls[0][3];
    emit('pnpm-lock.yaml', 'pruned-lock');
    const lockfileEmit = emitAsset.mock.calls.find(
      ([name]) => name === 'pnpm-lock.yaml'
    );
    expect(lockfileEmit[1].source()).toBe('pruned-lock');
  });

  it('emits the manifest after the deploy output, which rewrites it', async () => {
    const emitAsset = await runPlugin();

    const packageJsonEmitIndex = emitAsset.mock.calls.findIndex(
      ([name]) => name === 'package.json'
    );
    expect(
      (generatePrunedDeployOutput as Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(emitAsset.mock.invocationCallOrder[packageJsonEmitIndex]);
  });

  it('leaves the bun decision to the deploy output', async () => {
    (detectPackageManager as Mock).mockReturnValue('bun');

    const emitAsset = await runPlugin();

    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ packageManager: 'bun' })
    );
    expect(emitAsset.mock.calls.map(([name]) => name)).toEqual([
      'package.json',
    ]);
  });
});
