import type { Mock } from 'vitest';
import type { ExecutorContext } from '@nx/devkit';
import { detectPackageManager, readJsonFile, writeJsonFile } from '@nx/devkit';
import { createPackageJson, generatePrunedDeployOutput } from '@nx/js';
import { fork } from 'child_process';
import { statSync } from 'fs-extra';

import buildExecutor from './build.impl';
import type { RemixBuildSchema } from './schema';

vi.mock('../../utils/deprecation', () => ({
  warnRemixBuildExecutorDeprecation: vi.fn(),
}));

vi.mock('child_process', async () => ({
  ...(await vi.importActual<any>('child_process')),
  fork: vi.fn(),
}));

vi.mock('fs-extra', async () => ({
  ...(await vi.importActual<any>('fs-extra')),
  copySync: vi.fn(),
  mkdir: vi.fn(),
  statSync: vi.fn(() => ({ isDirectory: () => true })),
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
    vi.clearAllMocks();
    manifest = { name: 'my-app', version: '1.0.0' };
    (createPackageJson as Mock).mockReturnValue(manifest);
    (detectPackageManager as Mock).mockReturnValue('pnpm');
    (readJsonFile as Mock).mockReturnValue({});
    (statSync as Mock).mockReturnValue({ isDirectory: () => true });
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
