import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { spawn } from 'child_process';
import { setLiveClientBerryEnv } from '../../../daemon/client/daemon-environment';
import { waitForSocketConnection } from '../../../utils/wait-for-socket-connection';
import { IsolatedPlugin } from './isolated-plugin';

vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: vi.fn(),
}));
vi.mock('../../../daemon/socket-utils', () => ({
  getPluginOsSocketPath: vi.fn(() => '/mock/socket/path'),
}));
vi.mock('../../../utils/installation-directory', () => ({
  getNxRequirePaths: vi.fn(() => ['/mock/require/path']),
}));
vi.mock('../../../utils/wait-for-socket-connection', () => ({
  waitForSocketConnection: vi.fn(),
}));
vi.mock('../resolve-plugin', () => ({
  resolveNxPlugin: vi.fn().mockResolvedValue({
    name: 'test-plugin',
    pluginPath: '/mock/plugin/path',
    shouldRegisterTSTranspiler: false,
  }),
}));

describe.skipIf(process.platform === 'win32')('plugin worker env', () => {
  const originalEnv = process.env;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-berry-'));
    process.env = { ...originalEnv, PATH: '/usr/bin' };
    delete process.env.BERRY_BIN_FOLDER;
    const worker = Object.assign(new EventEmitter(), {
      pid: 4242,
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      unref: () => {},
      kill: () => true,
    });
    vi.mocked(spawn).mockReturnValue(worker as any);
    vi.mocked(waitForSocketConnection).mockImplementation(async () => {
      worker.emit('exit', 1, null);
      return null;
    });
  });

  afterEach(() => {
    setLiveClientBerryEnv(undefined);
    process.env = originalEnv;
    rmSync(root, { recursive: true, force: true });
  });

  async function spawnedWorkerEnv(): Promise<NodeJS.ProcessEnv> {
    await IsolatedPlugin.load('test-plugin', '/root').catch(() => {});
    return vi.mocked(spawn).mock.lastCall[2].env;
  }

  function yarnEnv(folder: string) {
    return {
      BERRY_BIN_FOLDER: folder,
      PATH: [folder, '/usr/bin'].join(delimiter),
    };
  }

  it("spawns workers with the live client's Berry folder", async () => {
    const folder = join(root, 'xfs-1a2b3c4d');
    mkdirSync(folder, { mode: 0o755 });
    setLiveClientBerryEnv(yarnEnv(folder));

    const env = await spawnedWorkerEnv();

    expect(env).toMatchObject(yarnEnv(folder));
  });

  it('spawns workers without a Berry folder that no longer exists', async () => {
    Object.assign(process.env, yarnEnv(join(root, 'xfs-1a2b3c4d')));

    const env = await spawnedWorkerEnv();

    expect(env.PATH).toEqual('/usr/bin');
    expect(env.BERRY_BIN_FOLDER).toBeUndefined();
  });
});
