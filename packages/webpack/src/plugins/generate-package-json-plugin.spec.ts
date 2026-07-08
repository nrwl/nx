import type { ProjectGraph } from '@nx/devkit';
import { detectPackageManager } from '@nx/devkit';
import {
  createLockFile,
  createPackageJson,
  emitPrunedPnpmInstallAssets,
  getLockFileName,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
} from '@nx/js';
import { GeneratePackageJsonPlugin } from './generate-package-json-plugin';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createLockFile: jest.fn(),
  createPackageJson: jest.fn(),
  emitPrunedPnpmInstallAssets: jest.fn(),
  getHelperDependenciesFromProjectGraph: jest.fn(() => []),
  getLockFileName: jest.fn(() => 'pnpm-lock.yaml'),
  getWorkspacePackagesFromGraph: jest.fn(() => new Map()),
  readTsConfig: jest.fn(() => ({ options: {} })),
  rewritePrunedLocalPathSpecifiers: jest.fn(),
  validatePrunedLocalPathClosure: jest.fn(),
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
    (createLockFile as jest.Mock).mockReturnValue('pruned-lock');
    (getLockFileName as jest.Mock).mockReturnValue('pnpm-lock.yaml');
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
  });

  function runPlugin(): jest.Mock {
    const emitAsset = jest.fn();
    const compilation = {
      hooks: {
        processAssets: { tap: (_opts: unknown, fn: () => void) => fn() },
      },
      emitAsset,
      getLogger: () => ({ warn: jest.fn() }),
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
    return emitAsset;
  }

  it('rewrites local-path specifiers and validates the link: closure for a pruned pnpm lockfile', () => {
    runPlugin();

    expect(rewritePrunedLocalPathSpecifiers).toHaveBeenCalledWith(
      packageJson,
      'apps/my-app',
      '/root',
      new Set()
    );
    // The lockfile importer copies manifest specifiers, so the rewrite must
    // run before createLockFile.
    expect(
      (rewritePrunedLocalPathSpecifiers as jest.Mock).mock
        .invocationCallOrder[0]
    ).toBeLessThan((createLockFile as jest.Mock).mock.invocationCallOrder[0]);
    expect(validatePrunedLocalPathClosure).toHaveBeenCalledWith(
      packageJson,
      '/root',
      'pruned-lock'
    );
    expect(emitPrunedPnpmInstallAssets).toHaveBeenCalledWith(
      '/root',
      'pruned-lock',
      packageJson,
      expect.any(Function),
      { includeLocalPathArtifacts: true }
    );
  });

  it('skips the link: validation and local-path shipping on the root-lockfile fallback', () => {
    (createLockFile as jest.Mock).mockImplementation(
      (_pkg, _graph, _pm, opts) => {
        opts?.onPruneFallback?.(new Error('prune failed'));
        return 'root-lock';
      }
    );

    runPlugin();

    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(emitPrunedPnpmInstallAssets).toHaveBeenCalledWith(
      '/root',
      'root-lock',
      packageJson,
      expect.any(Function),
      { includeLocalPathArtifacts: false }
    );
  });

  it('leaves the manifest untouched for a non-pnpm package manager', () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
    (getLockFileName as jest.Mock).mockReturnValue('package-lock.json');

    runPlugin();

    expect(rewritePrunedLocalPathSpecifiers).not.toHaveBeenCalled();
    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(emitPrunedPnpmInstallAssets).not.toHaveBeenCalled();
  });
});
