import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, readJsonFile, writeJsonFile } from '@nx/devkit';
import {
  createPackageJson,
  createPrunedLockfile,
  getLockFileName,
  writePrunedPnpmInstallSettings,
} from '@nx/js';
import { fork } from 'child_process';
import { statSync, writeFileSync } from 'fs-extra';

import buildExecutor from './build.impl';
import type { RemixBuildSchema } from './schema';

jest.mock('../../utils/deprecation', () => ({
  warnRemixBuildExecutorDeprecation: jest.fn(),
}));

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  fork: jest.fn(),
}));

jest.mock('fs-extra', () => ({
  ...jest.requireActual('fs-extra'),
  copySync: jest.fn(),
  mkdir: jest.fn(),
  statSync: jest.fn(() => ({ isDirectory: () => true })),
  writeFileSync: jest.fn(),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
  readJsonFile: jest.fn(() => ({})),
  writeJsonFile: jest.fn(),
}));

jest.mock('@nx/js', () => ({
  ...jest.requireActual('@nx/js'),
  createPackageJson: jest.fn(),
  createPrunedLockfile: jest.fn(),
  getLockFileName: jest.fn(() => 'pnpm-lock.yaml'),
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

describe('remix build executor lockfile wiring', () => {
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

  const options: RemixBuildSchema = {
    outputPath: 'apps/my-app',
    generatePackageJson: true,
    generateLockfile: true,
  };

  let manifest: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    manifest = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as jest.Mock).mockReturnValue(manifest);
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'pruned-lock',
      pruned: true,
    });
    (getLockFileName as jest.Mock).mockReturnValue('pnpm-lock.yaml');
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    (readJsonFile as jest.Mock).mockReturnValue({});
    (statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
    (fork as jest.Mock).mockImplementation(() => createFakeChildProcess());
  });

  it('creates the pruned pnpm lockfile before the manifest is written', async () => {
    const result = await buildExecutor(options, context);

    expect(result).toEqual({ success: true });
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
      'apps/my-app/pnpm-lock.yaml',
      'pruned-lock',
      { encoding: 'utf-8' }
    );
    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      'apps/my-app',
      '/root',
      'pruned-lock',
      { includeLocalPathArtifacts: true }
    );
  });

  it('ships the root-lockfile fallback without its local-path artifacts', async () => {
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'root-lock',
      pruned: false,
    });

    await buildExecutor(options, context);

    expect(writeFileSync).toHaveBeenCalledWith(
      'apps/my-app/pnpm-lock.yaml',
      'root-lock',
      { encoding: 'utf-8' }
    );
    expect(writePrunedPnpmInstallSettings).toHaveBeenCalledWith(
      'apps/my-app',
      '/root',
      'root-lock',
      { includeLocalPathArtifacts: false }
    );
  });

  it('writes no pnpm install settings for a non-pnpm package manager', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
    (getLockFileName as jest.Mock).mockReturnValue('package-lock.json');
    (createPrunedLockfile as jest.Mock).mockReturnValue({
      lockFileContent: 'npm-lock',
      pruned: true,
    });

    await buildExecutor(options, context);

    expect(createPrunedLockfile).toHaveBeenCalledWith(
      manifest,
      context.projectGraph,
      'apps/my-app',
      '/root',
      'npm'
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      'apps/my-app/package-lock.json',
      'npm-lock',
      { encoding: 'utf-8' }
    );
    expect(writePrunedPnpmInstallSettings).not.toHaveBeenCalled();
  });
});
