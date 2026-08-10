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

  function runPlugin(): { emitAsset: jest.Mock; warn: jest.Mock } {
    const emitAsset = jest.fn();
    const warn = jest.fn();
    const compilation = {
      hooks: {
        processAssets: { tap: (_opts: unknown, fn: () => void) => fn() },
      },
      emitAsset,
      getLogger: () => ({ warn }),
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
    return { emitAsset, warn };
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

  it('generates no deploy output for bun, which has no lockfile generation', () => {
    (detectPackageManager as jest.Mock).mockReturnValue('bun');

    const { emitAsset, warn } = runPlugin();

    expect(generatePrunedDeployOutput).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Bun lockfile generation is not supported. Only package.json will be generated.'
    );
    expect(emitAsset.mock.calls.map(([name]) => name)).toEqual([
      'package.json',
    ]);
  });
});
