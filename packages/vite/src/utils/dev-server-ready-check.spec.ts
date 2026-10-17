import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, type AddressInfo, type Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getViteServerAddress,
  parseViteFlags,
  waitForViteServer,
} from './dev-server-ready-check';

// `Function('return import("vite")')` has no dynamic import callback in the vm
vi.mock('./executor-utils', () => ({
  loadViteDynamicImport: () => import('vite'),
}));

describe('parseViteFlags', () => {
  it('reads the port, host and mode from options and args', () => {
    expect(
      parseViteFlags({ args: ['--port', '3000', '--host', '--mode=staging'] })
    ).toEqual({ port: '3000', host: true, mode: 'staging' });
    expect(parseViteFlags({ port: 3001, args: '--port 3000' })).toEqual({
      port: '3001',
    });
  });
});

describe('getViteServerAddress', () => {
  it("takes the flag, then the config, then Vite's default port", () => {
    expect(getViteServerAddress({ port: 5000 }, { port: '3000' }, 'serve')).toEqual({ port: 3000 });
    expect(getViteServerAddress({ port: 5000 }, {}, 'serve')).toEqual({ port: 5000 });
    expect(getViteServerAddress({}, {}, 'serve')).toEqual({ port: 5173 });
    expect(getViteServerAddress({}, {}, 'preview')).toEqual({ port: 4173 });
  });

  it('probes loopback unless a specific host is named', () => {
    expect(getViteServerAddress({ port: 1, host: true }, {}, 'serve')).toEqual({ port: 1 });
    expect(getViteServerAddress({ port: 1, host: 'dev.local' }, {}, 'serve')).toEqual({ port: 1, host: 'dev.local' });
  });
});

describe('waitForViteServer', () => {
  let dir: string;
  let server: Server;
  let port: number;
  const cwd = process.cwd();

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-vite-ready-'));
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

  it('reads the port the config computes from the task env', async () => {
    const config = join(dir, 'vite.config.mjs');
    writeFileSync(
      config,
      `export default ({ mode }) => ({ server: { port: mode === 'development' ? Number(process.env.APP_PORT) : 1 } });`
    );
    vi.stubEnv('APP_PORT', String(port));
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir }));

    await expect(waitForViteServer(config, 'serve')).resolves.toBeUndefined();
  });

  it('reads the preview port in preview', async () => {
    const config = join(dir, 'vite.config.mjs');
    writeFileSync(
      config,
      `export default { server: { port: 1 }, preview: { port: ${port} } };`
    );
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir }));

    await expect(waitForViteServer(config, 'preview')).resolves.toBeUndefined();
  });
});
