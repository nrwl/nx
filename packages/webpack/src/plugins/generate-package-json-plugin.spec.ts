import type { ProjectGraph } from '@nx/devkit';
import { detectPackageManager } from '@nx/devkit';
import { createPackageJson, generatePrunedDeployOutput } from '@nx/js';
import { GeneratePackageJsonPlugin } from './generate-package-json-plugin';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createPackageJson: jest.fn(),
  generatePrunedDeployOutput: jest.fn(),
  getHelperDependenciesFromProjectGraph: jest.fn(() => []),
  readTsConfig: jest.fn(() => ({ options: {} })),
}));

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
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
  });

  function runPlugin(): { emitAsset: jest.Mock } {
    const emitAsset = jest.fn();
    const compilation = {
      hooks: {
        processAssets: { tap: (_opts: unknown, fn: () => void) => fn() },
      },
      emitAsset,
    };
    const compiler = {
      webpack: { Compilation: { PROCESS_ASSETS_STAGE_ADDITIONAL: 100 } },
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
    return { emitAsset };
  }

  it('generates the pruned deploy output into the compilation assets', () => {
    const { emitAsset } = runPlugin();

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
    const { emit } = (generatePrunedDeployOutput as jest.Mock).mock.calls[0][3];
    emit('pnpm-lock.yaml', 'pruned-lock');
    const lockfileEmit = emitAsset.mock.calls.find(
      ([name]) => name === 'pnpm-lock.yaml'
    );
    expect(lockfileEmit[1].source()).toBe('pruned-lock');
  });

  it('emits the manifest after the deploy output, which rewrites it', () => {
    const { emitAsset } = runPlugin();

    const packageJsonEmitIndex = emitAsset.mock.calls.findIndex(
      ([name]) => name === 'package.json'
    );
    expect(
      (generatePrunedDeployOutput as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(emitAsset.mock.invocationCallOrder[packageJsonEmitIndex]);
  });

  it('passes a detected bun through for the deploy output to decide', () => {
    (detectPackageManager as jest.Mock).mockReturnValue('bun');

    const { emitAsset } = runPlugin();

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
