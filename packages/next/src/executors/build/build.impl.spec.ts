import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, readJsonFile, writeJsonFile } from '@nx/devkit';
import {
  createLockFile,
  createPackageJson,
  getLockFileName,
  getWorkspacePackagesFromGraph,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
  writePrunedPnpmInstallSettings,
} from '@nx/js';
import { fork } from 'child_process';
import { existsSync } from 'node:fs';

import buildExecutor from './build.impl';
import type { NextBuildBuilderOptions } from '../../utils/types';

jest.mock('../../utils/deprecation', () => ({
  warnNextBuildExecutorDeprecation: jest.fn(),
}));

jest.mock('./lib/check-project', () => ({
  checkPublicDirectory: jest.fn(),
}));

jest.mock('./lib/update-package-json', () => ({
  updatePackageJson: jest.fn(),
}));

jest.mock('./lib/create-next-config-file', () => ({
  createNextConfigFile: jest.fn(),
}));

jest.mock('../../utils/runtime-version-utils', () => ({
  getInstalledNextVersionRuntime: jest.fn(() => 15),
}));

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  fork: jest.fn(),
}));

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  cpSync: jest.fn(),
  existsSync: jest.fn(() => false),
  writeFileSync: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  mkdir: jest.fn(),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
  readJsonFile: jest.fn(() => ({})),
  writeJsonFile: jest.fn(),
}));

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createLockFile: jest.fn(),
  createPackageJson: jest.fn(),
  getLockFileName: jest.fn(() => 'pnpm-lock.yaml'),
  getWorkspacePackagesFromGraph: jest.fn(() => new Map()),
  rewritePrunedLocalPathSpecifiers: jest.fn(),
  validatePrunedLocalPathClosure: jest.fn(),
  writePrunedPnpmInstallSettings: jest.fn(),
}));

// The build's child process is forked; exit fires async so the executor's
// await resolves like a real build would.
function createFakeChildProcess() {
  const child: any = { kill: jest.fn() };
  child.on = jest.fn((event: string, cb: (...args: any[]) => void) => {
    if (event === 'exit') {
      setImmediate(() => cb(0, null));
    }
    return child;
  });
  return child;
}

describe('next build executor lockfile wiring', () => {
  const context = {
    root: '/root',
    projectName: 'my-app',
    targetName: 'build',
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
    cwd: '/root',
    isVerbose: false,
    projectsConfigurations: {
      version: 2,
      projects: { 'my-app': { root: 'apps/my-app' } },
    },
    nxJsonConfiguration: {},
  } as unknown as ExecutorContext;

  const options: NextBuildBuilderOptions = {
    outputPath: 'apps/my-app',
    generateLockfile: true,
    fileReplacements: [],
  };

  let manifest: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    manifest = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as jest.Mock).mockReturnValue(manifest);
    (createLockFile as jest.Mock).mockReturnValue('pruned-lock');
    (getLockFileName as jest.Mock).mockReturnValue('pnpm-lock.yaml');
    (getWorkspacePackagesFromGraph as jest.Mock).mockReturnValue(new Map());
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    (existsSync as jest.Mock).mockReturnValue(false);
    (readJsonFile as jest.Mock).mockReturnValue({});
    (fork as jest.Mock).mockImplementation(() => createFakeChildProcess());
  });

  it('rewrites local-path specifiers before the manifest and lockfile are written for pnpm', async () => {
    const result = await buildExecutor(options, context);

    expect(result).toEqual({ success: true });
    expect(rewritePrunedLocalPathSpecifiers).toHaveBeenCalledWith(
      manifest,
      'apps/my-app',
      '/root',
      new Set()
    );
    // The lockfile importer and the written manifest copy specifiers, so the
    // rewrite must run before both.
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
      'apps/my-app',
      '/root',
      'pruned-lock',
      { includeLocalPathArtifacts: true }
    );
  });

  it('skips the link: validation and ships the root-lockfile fallback settings', async () => {
    (createLockFile as jest.Mock).mockImplementation(
      (_pkg, _graph, _pm, opts) => {
        opts?.onPruneFallback?.(new Error('prune failed'));
        return 'root-lock';
      }
    );

    await buildExecutor(options, context);

    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      'apps/my-app',
      '/root',
      'root-lock',
      { includeLocalPathArtifacts: false }
    );
  });

  it('leaves the manifest untouched for a non-pnpm package manager', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
    (getLockFileName as jest.Mock).mockReturnValue('package-lock.json');

    await buildExecutor(options, context);

    expect(rewritePrunedLocalPathSpecifiers).not.toHaveBeenCalled();
    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(writePrunedPnpmInstallSettings).not.toHaveBeenCalled();
  });
});
