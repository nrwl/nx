import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, readJsonFile, writeJsonFile } from '@nx/devkit';
import { createPackageJson, generatePrunedDeployOutput } from '@nx/js';
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
  createPackageJson: jest.fn(),
  generatePrunedDeployOutput: jest.fn(),
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
    (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
    (existsSync as jest.Mock).mockReturnValue(false);
    (readJsonFile as jest.Mock).mockReturnValue({});
    (fork as jest.Mock).mockImplementation(() => createFakeChildProcess());
  });

  it('generates the pruned deploy output before the manifest is written', async () => {
    const result = await buildExecutor(options, context);

    expect(result).toEqual({ success: true });
    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      manifest,
      context.projectGraph,
      'apps/my-app',
      {
        outputDirectory: 'apps/my-app',
        packageManager: 'pnpm',
        workspaceRoot: '/root',
      }
    );
    // The deploy output rewrites the manifest's local-path specifiers, so the
    // manifest must be written after it.
    expect(
      (generatePrunedDeployOutput as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((writeJsonFile as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('generates no deploy output for bun, which has no lockfile generation', async () => {
    (detectPackageManager as jest.Mock).mockReturnValue('bun');

    await buildExecutor(options, context);

    expect(generatePrunedDeployOutput).not.toHaveBeenCalled();
    expect(writeJsonFile).toHaveBeenCalledWith(
      'apps/my-app/package.json',
      manifest
    );
  });

  it('generates no deploy output when generateLockfile is off', async () => {
    await buildExecutor({ ...options, generateLockfile: false }, context);

    expect(generatePrunedDeployOutput).not.toHaveBeenCalled();
  });
});
