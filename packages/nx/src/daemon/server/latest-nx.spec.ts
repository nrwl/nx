import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const spawnedEnvs = vi.hoisted(() => [] as NodeJS.ProcessEnv[]);

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
  getPluginsIfLoadedOrLoading: vi.fn(),
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
});
