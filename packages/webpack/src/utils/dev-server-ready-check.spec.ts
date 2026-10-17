import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, type AddressInfo, type Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getDevServerAddress,
  parseServeFlags,
  waitForWebpackDevServer,
} from './dev-server-ready-check';

describe('parseServeFlags', () => {
  it('reads the port, host and config names from options and args', () => {
    expect(
      parseServeFlags({
        args: ['--port', '4300', '--host=0.0.0.0', '--config-name', 'client'],
      })
    ).toEqual({ port: '4300', host: '0.0.0.0', configNames: ['client'] });
    expect(parseServeFlags({ args: '--port=4301 --hot' })).toEqual({
      port: '4301',
      configNames: [],
    });
  });

  it('lets a named option win over args', () => {
    expect(
      parseServeFlags({ port: 4400, args: ['--port', '4300'] })
    ).toMatchObject({ port: '4400' });
  });
});

describe('getDevServerAddress', () => {
  const flags = { configNames: [] };

  it('takes the flag, then devServer.port, then the base port, then 8080', () => {
    expect(getDevServerAddress({ port: 4200 }, { ...flags, port: '4300' }, undefined)).toEqual({ port: 4300 });
    expect(getDevServerAddress({ port: 4200 }, flags, '9000')).toEqual({ port: 4200 });
    expect(getDevServerAddress({}, flags, '9000')).toEqual({ port: 9000 });
    expect(getDevServerAddress(undefined, flags, undefined)).toEqual({ port: 8080 });
  });

  it('has no address when the server picks its port or listens on a socket', () => {
    expect(getDevServerAddress({ port: 'auto' }, flags, undefined)).toBeNull();
    expect(getDevServerAddress({ port: 0 }, flags, undefined)).toBeNull();
    expect(getDevServerAddress({ ipc: true }, flags, undefined)).toBeNull();
  });

  it('probes loopback for wildcard hosts and the named host otherwise', () => {
    expect(getDevServerAddress({ port: 1, host: '0.0.0.0' }, flags, undefined)).toEqual({ port: 1 });
    expect(getDevServerAddress({ port: 1, host: 'dev.local' }, flags, undefined)).toEqual({ port: 1, host: 'dev.local' });
  });
});

describe('waitForWebpackDevServer', () => {
  let dir: string;
  let server: Server;
  let port: number;
  const cwd = process.cwd();

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-webpack-ready-'));
    server = createServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await new Promise((r) => server.close(r));
  });

  it('reads the port the config computes from the task env in serve mode', async () => {
    const config = join(dir, 'webpack.config.js');
    writeFileSync(
      config,
      `module.exports = (env) => ({ devServer: { port: env.WEBPACK_SERVE ? Number(process.env.APP_PORT) : 1 } });`
    );
    vi.stubEnv('APP_PORT', String(port));
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir }));

    await expect(waitForWebpackDevServer(config)).resolves.toBeUndefined();
  });

  it('follows --port in the args of the target', async () => {
    const config = join(dir, 'webpack.config.js');
    writeFileSync(config, `module.exports = { devServer: { port: 1 } };`);
    vi.stubEnv(
      'NX_TASK_OPTIONS',
      JSON.stringify({ cwd: dir, args: [`--port=${port}`] })
    );

    await expect(waitForWebpackDevServer(config)).resolves.toBeUndefined();
  });
});
