import type { ProjectGraph } from '@nx/devkit';
import { detectPackageManager } from '@nx/devkit';
import {
  createPackageJson,
  createPrunedLockfile,
  emitPrunedPnpmInstallAssets,
  getLockFileName,
} from '@nx/js';
import { GeneratePackageJsonPlugin } from './generate-package-json-plugin';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createPackageJson: jest.fn(),
  createPrunedLockfile: jest.fn(),
  emitPrunedPnpmInstallAssets: jest.fn(),
  getHelperDependenciesFromProjectGraph: jest.fn(() => []),
  getLockFileName: jest.fn(() => 'pnpm-lock.yaml'),
  readTsConfig: jest.fn(() => ({ options: {} })),
}));

// Fake source wrapper so the plugin's `new sources.RawSource(...)` calls have
// something to construct without pulling in the real rspack sources module.
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

  let packageJson: { name: string; version: string };

  beforeEach(() => {
    jest.clearAllMocks();
    packageJson = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as jest.Mock).mockReturnValue(packageJson);
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'pruned-lock',
      pruned: true,
    });
    (getLockFileName as jest.Mock).mockReturnValue('pnpm-lock.yaml');
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
  });

  async function runPlugin(): Promise<jest.Mock> {
    const emitAsset = jest.fn();
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
      getLogger: () => ({ warn: jest.fn() }),
    };
    const compiler = {
      rspack: {
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
    new GeneratePackageJsonPlugin({
      tsConfig: '/root/apps/my-app/tsconfig.json',
      outputFileName: 'main.js',
      root: '/root',
      projectName: 'my-app',
      targetName: 'build',
      projectGraph,
    }).apply(compiler as any);
    await processAssetsResult;
    return emitAsset;
  }

  it('creates the pruned pnpm lockfile and ships the pruned install assets', async () => {
    const emitAsset = await runPlugin();

    expect(createPrunedLockfile).toHaveBeenCalledWith(
      packageJson,
      projectGraph,
      'apps/my-app',
      '/root',
      'pnpm'
    );
    const lockfileEmit = emitAsset.mock.calls.find(
      ([name]) => name === 'pnpm-lock.yaml'
    );
    expect(lockfileEmit[1].source()).toBe('pruned-lock');
    // createPrunedLockfile relocates the manifest's local-path specifiers, so
    // the manifest must be emitted after it.
    const packageJsonEmitIndex = emitAsset.mock.calls.findIndex(
      ([name]) => name === 'package.json'
    );
    expect(
      (createPrunedLockfile as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(emitAsset.mock.invocationCallOrder[packageJsonEmitIndex]);
    expect(emitPrunedPnpmInstallAssets).toHaveBeenCalledWith(
      '/root',
      'pruned-lock',
      packageJson,
      expect.any(Function),
      { includeLocalPathArtifacts: true }
    );
  });

  it('skips the local-path shipping on the root-lockfile fallback', async () => {
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'root-lock',
      pruned: false,
    });

    await runPlugin();

    expect(emitPrunedPnpmInstallAssets).toHaveBeenCalledWith(
      '/root',
      'root-lock',
      packageJson,
      expect.any(Function),
      { includeLocalPathArtifacts: false }
    );
  });

  it('emits no pnpm install assets for a non-pnpm package manager', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
    (getLockFileName as jest.Mock).mockReturnValue('package-lock.json');
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'npm-lock',
      pruned: true,
    });

    const emitAsset = await runPlugin();

    expect(createPrunedLockfile).toHaveBeenCalledWith(
      packageJson,
      projectGraph,
      'apps/my-app',
      '/root',
      'npm'
    );
    const lockfileEmit = emitAsset.mock.calls.find(
      ([name]) => name === 'package-lock.json'
    );
    expect(lockfileEmit[1].source()).toBe('npm-lock');
    expect(emitPrunedPnpmInstallAssets).not.toHaveBeenCalled();
  });
});
