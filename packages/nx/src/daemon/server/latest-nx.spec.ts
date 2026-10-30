import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const spawnedEnvs = vi.hoisted(() => [] as NodeJS.ProcessEnv[]);
const execCalls = vi.hoisted(
  () => [] as { command: string; env: NodeJS.ProcessEnv }[]
);

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const record = (args: unknown[]) => {
    const options = args.find(
      (arg) => typeof arg === 'object' && arg !== null && !Array.isArray(arg)
    ) as { env?: NodeJS.ProcessEnv } | undefined;
    spawnedEnvs.push(options?.env ?? process.env);
    return new Error('offline');
  };
  return {
    ...actual,
    exec: (...args: unknown[]) => {
      execCalls.push({
        command: args[0] as string,
        env: (args[1] as { env?: NodeJS.ProcessEnv }).env,
      });
      const error = record(args);
      (args.find((arg) => typeof arg === 'function') as Function)?.(error);
    },
    execFile: (...args: unknown[]) => {
      const error = record(args);
      (args.find((arg) => typeof arg === 'function') as Function)?.(error);
    },
    execSync: (...args: unknown[]) => {
      throw record(args);
    },
    execFileSync: (...args: unknown[]) => {
      throw record(args);
    },
  };
});
vi.mock('../../project-graph/plugins/get-plugins', () => ({
  daemonHostsPluginsInProcess: () => false,
  getPluginsIfLoadedOrLoading: vi.fn(),
}));
vi.mock('../../utils/package-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/package-manager')>()),
  detectPackageManager: () => 'yarn',
  getPackageManagerVersion: () => '4.0.0',
}));
vi.mock('./project-graph-incremental-recomputation', () => ({
  invalidateGraphCache: vi.fn(),
}));

import { handleClientEnv } from './handle-client-env';
import { getLatestNxTmpPath } from './latest-nx';

describe.skipIf(process.platform === 'win32')('getLatestNxTmpPath', () => {
  const originalEnv = process.env;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-berry-'));
    process.env = { ...originalEnv };
    delete process.env.NX_SKIP_PROVENANCE_CHECK;
    spawnedEnvs.length = 0;
    execCalls.length = 0;
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(root, { recursive: true, force: true });
  });

  it("runs the package manager without a Yarn Berry client's bin folder", async () => {
    const folder = join(root, 'xfs-1a2b3c4d');
    mkdirSync(folder, { mode: 0o755 });
    await handleClientEnv(
      {
        ...(process.env as Record<string, string>),
        BERRY_BIN_FOLDER: folder,
        PATH: [folder, process.env.PATH].join(delimiter),
      },
      new EventEmitter()
    );

    await getLatestNxTmpPath().catch(() => {});

    expect(spawnedEnvs.length).toBeGreaterThan(0);
    for (const env of spawnedEnvs) {
      expect(env.PATH.split(delimiter)).not.toContain(folder);
    }
  });

  describe('installing with Yarn', () => {
    let bin: string;

    function addExecutable(dir: string, name: string) {
      writeFileSync(join(dir, name), '', { mode: 0o755 });
    }

    beforeEach(() => {
      process.env.NX_SKIP_PROVENANCE_CHECK = 'true';
      bin = join(root, 'bin');
      mkdirSync(bin);
      addExecutable(bin, 'corepack');
      process.env.PATH = bin;
    });

    async function install() {
      execCalls.length = 0;
      await getLatestNxTmpPath().catch(() => {});
      expect(execCalls.length).toBeGreaterThan(0);
      return execCalls;
    }

    it("runs it from a connected client's own bin folder", async () => {
      const folder = join(root, 'xfs-2b3c4d5e');
      mkdirSync(folder, { mode: 0o755 });
      addExecutable(folder, 'yarn');
      const unowned = join(root, 'xfs-3c4d5e6f');
      mkdirSync(unowned, { mode: 0o755 });
      const client = new EventEmitter();
      await handleClientEnv(
        {
          ...(process.env as Record<string, string>),
          BERRY_BIN_FOLDER: folder,
          PATH: [folder, unowned, bin].join(delimiter),
        },
        client
      );

      for (const { command, env } of await install()) {
        expect(command).toMatch(/^yarn /);
        expect(env.PATH.split(delimiter)).toContain(folder);
        expect(env.PATH.split(delimiter)).not.toContain(unowned);
      }

      client.emit('close');
      await new Promise(setImmediate);

      for (const { command, env } of await install()) {
        expect(command).toMatch(/^corepack yarn /);
        expect(env.PATH.split(delimiter)).not.toContain(folder);
      }
    });

    it('runs it through Corepack when no yarn is on PATH', async () => {
      for (const { command } of await install()) {
        expect(command).toMatch(/^corepack yarn /);
      }
    });

    it('runs yarn directly when it is on PATH', async () => {
      addExecutable(bin, 'yarn');

      for (const { command } of await install()) {
        expect(command).toMatch(/^yarn /);
      }
    });
  });
});
