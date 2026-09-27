import type { Mock } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, readJsonFile, writeJsonFile } from '@nx/devkit';
import { createPackageJson, generatePrunedDeployOutput } from '@nx/js';
import { fork } from 'child_process';
import { existsSync } from 'node:fs';

import buildExecutor from './build.impl';
import type { NextBuildBuilderOptions } from '../../utils/types';

vi.mock('../../utils/deprecation', () => ({
  warnNextBuildExecutorDeprecation: vi.fn(),
}));

vi.mock('./lib/check-project', () => ({
  checkPublicDirectory: vi.fn(),
}));

vi.mock('./lib/update-package-json', () => ({
  updatePackageJson: vi.fn(),
}));

vi.mock('./lib/create-next-config-file', () => ({
  createNextConfigFile: vi.fn(),
}));

vi.mock('../../utils/runtime-version-utils', () => ({
  getInstalledNextVersionRuntime: vi.fn(() => 15),
}));

vi.mock('child_process', async () => ({
  ...(await vi.importActual<any>('child_process')),
  fork: vi.fn(),
}));

vi.mock('node:fs', async () => ({
  ...(await vi.importActual<any>('node:fs')),
  cpSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

vi.mock('node:fs/promises', async () => ({
  ...(await vi.importActual<any>('node:fs/promises')),
  mkdir: vi.fn(),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  detectPackageManager: vi.fn(),
  readJsonFile: vi.fn(() => ({})),
  writeJsonFile: vi.fn(),
}));

vi.mock('@nx/js', async () => ({
  ...(await vi.importActual<any>('@nx/js')),
  createPackageJson: vi.fn(),
  generatePrunedDeployOutput: vi.fn(),
}));

// The build's child process is forked; exit fires async so the executor's
// await resolves like a real build would.
function createFakeChildProcess() {
  const child: any = { kill: vi.fn() };
  child.on = vi.fn((event: string, cb: (...args: any[]) => void) => {
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
    vi.clearAllMocks();
    manifest = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as Mock).mockReturnValue(manifest);
    (detectPackageManager as Mock).mockReturnValue('pnpm');
    (existsSync as Mock).mockReturnValue(false);
    (readJsonFile as Mock).mockReturnValue({});
    (fork as Mock).mockImplementation(() => createFakeChildProcess());
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
      (generatePrunedDeployOutput as Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((writeJsonFile as Mock).mock.invocationCallOrder[0]);
  });

  it('leaves the bun decision to the deploy output', async () => {
    (detectPackageManager as Mock).mockReturnValue('bun');

    await buildExecutor(options, context);

    expect(generatePrunedDeployOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ packageManager: 'bun' })
    );
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
