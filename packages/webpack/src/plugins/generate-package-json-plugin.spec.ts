import type { Mock } from 'vitest';
import Module from 'module';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ProjectGraph } from '@nx/devkit';
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
    vi.clearAllMocks();
    packageJson = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as Mock).mockReturnValue(packageJson);
    (detectPackageManager as Mock).mockReturnValue('pnpm');
  });

  function runPlugin(runtimeDependencies?: string[]): { emitAsset: Mock } {
    const emitAsset = vi.fn();
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
      runtimeDependencies,
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
    const { emit } = (generatePrunedDeployOutput as Mock).mock.calls[0][3];
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
      (generatePrunedDeployOutput as Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(emitAsset.mock.invocationCallOrder[packageJsonEmitIndex]);
  });

  it('passes a detected bun through for the deploy output to decide', () => {
    (detectPackageManager as Mock).mockReturnValue('bun');

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

  it('adds a runtime dependency whose exports map hides package.json', () => {
    const originalNodePath = process.env.NODE_PATH;
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'runtime-deps-')));
    try {
      const pkgDir = join(dir, 'node_modules', 'fixture-runtime-dependency');
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({
          name: 'fixture-runtime-dependency',
          version: '2.0.0',
          exports: { '.': './index.js', './*': './*.js' },
        })
      );
      writeFileSync(join(pkgDir, 'index.js'), '');
      // Makes the fixture resolvable from the plugin's own location, as
      // packages installed next to it are.
      process.env.NODE_PATH = join(dir, 'node_modules');
      (Module as any)._initPaths();

      const { emitAsset } = runPlugin(['fixture-runtime-dependency']);

      const [, manifest] = emitAsset.mock.calls.find(
        ([name]) => name === 'package.json'
      );
      expect(JSON.parse(manifest.source()).dependencies).toEqual({
        'fixture-runtime-dependency': '2.0.0',
      });
    } finally {
      if (originalNodePath === undefined) {
        delete process.env.NODE_PATH;
      } else {
        process.env.NODE_PATH = originalNodePath;
      }
      (Module as any)._initPaths();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
