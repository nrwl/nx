import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, type AddressInfo, type Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getRsbuildServerAddress,
  parseRsbuildFlags,
  waitForRsbuildServer,
} from './dev-server-ready-check';

describe('parseRsbuildFlags', () => {
  it('reads the port, host and env mode from options and args', () => {
    expect(
      parseRsbuildFlags({
        args: ['--port', '3000', '--host', '--env-mode=staging'],
      })
    ).toEqual({ port: '3000', host: true, envMode: 'staging' });
    expect(parseRsbuildFlags({ port: 3001, args: '--port 3000' })).toEqual({
      port: '3001',
    });
  });
});

describe('getRsbuildServerAddress', () => {
  it("takes the flag, then the config, then Rsbuild's default port", () => {
    expect(getRsbuildServerAddress({ port: 5000 }, { port: '3100' })).toEqual({ port: 3100 });
    expect(getRsbuildServerAddress({ port: 5000 }, {})).toEqual({ port: 5000 });
    expect(getRsbuildServerAddress({}, {})).toEqual({ port: 3000 });
  });

  it('probes loopback unless a specific host is named', () => {
    expect(getRsbuildServerAddress({ port: 1, host: '0.0.0.0' }, {})).toEqual({ port: 1 });
    expect(getRsbuildServerAddress({ port: 1, host: 'dev.local' }, {})).toEqual({ port: 1, host: 'dev.local' });
  });
});

describe('waitForRsbuildServer', () => {
  let dir: string;
  let server: Server;
  let port: number;
  const cwd = process.cwd();
  const argv = [...process.argv];

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-rsbuild-ready-'));
    server = createServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    process.chdir(cwd);
    process.argv = [...argv];
    delete process.env.APP_PORT;
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await new Promise((r) => server.close(r));
  });

  it('reads the port the config computes from the env files of the env mode', async () => {
    const config = join(dir, 'rsbuild.config.mjs');
    writeFileSync(
      config,
      `export default ({ envMode, command }) => ({ server: { port: envMode === 'staging' && command === 'dev' ? Number(process.env.APP_PORT) : 1 } });`
    );
    writeFileSync(join(dir, '.env.staging'), `APP_PORT=${port}`);
    vi.stubEnv(
      'NX_TASK_OPTIONS',
      JSON.stringify({ cwd: dir, args: ['--env-mode=staging'] })
    );

    await expect(waitForRsbuildServer(config, 'dev')).resolves.toBeUndefined();
  });
});
