import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateAndSendWebserverConfig } from './webserver-config-worker';

describe('webserver-config-worker', () => {
  let dir: string;
  const originalArgv = process.argv;
  const originalSend = process.send;
  const originalUrl = process.env.NX_PW_WORKER_TEST_URL;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'pw-config-worker-'));
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.send = originalSend;
    if (originalUrl === undefined) {
      delete process.env.NX_PW_WORKER_TEST_URL;
    } else {
      process.env.NX_PW_WORKER_TEST_URL = originalUrl;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function workerArgs(): void {
    process.argv = ['node', 'worker.js', 'playwright.config.js', dir];
  }

  it('evaluates the config from argv under the spawned env and sends the normalized webServers', async () => {
    writeFileSync(
      join(dir, 'playwright.config.js'),
      `module.exports = {
  webServer: {
    command: 'npx nx run app1:serve',
    url: process.env.NX_PW_WORKER_TEST_URL || 'http://localhost:4200',
    reuseExistingServer: true,
    cwd: '/tmp/app',
    wait: { stdout: /ready/ },
  },
};`
    );
    const sent: unknown[] = [];
    process.send = ((
      message: unknown,
      callback: (error: Error | null) => void
    ) => {
      sent.push(message);
      callback(null);
      return true;
    }) as typeof process.send;
    workerArgs();
    process.env.NX_PW_WORKER_TEST_URL = 'http://localhost:4305';

    await evaluateAndSendWebserverConfig();

    expect(sent).toEqual([
      {
        type: 'webserver-config-result',
        webServers: [
          {
            command: 'npx nx run app1:serve',
            url: 'http://localhost:4305',
            reuseExistingServer: true,
            waitsForOutput: true,
          },
        ],
      },
    ]);
  });

  it('rejects when the channel reports a delivery failure', async () => {
    writeFileSync(join(dir, 'playwright.config.js'), 'module.exports = {};');
    process.send = ((
      _message: unknown,
      callback: (error: Error | null) => void
    ) => {
      callback(new Error('EPIPE'));
      return true;
    }) as typeof process.send;
    workerArgs();

    await expect(evaluateAndSendWebserverConfig()).rejects.toThrow('EPIPE');
  });

  it('rejects when the config cannot be loaded', async () => {
    writeFileSync(
      join(dir, 'playwright.config.js'),
      'throw new Error("config boom");'
    );
    process.send = ((
      _message: unknown,
      callback: (error: Error | null) => void
    ) => {
      callback(null);
      return true;
    }) as typeof process.send;
    workerArgs();

    await expect(evaluateAndSendWebserverConfig()).rejects.toThrow(
      /config boom/
    );
  });

  it('resolves without an IPC channel', async () => {
    writeFileSync(join(dir, 'playwright.config.js'), 'module.exports = {};');
    process.send = undefined;
    workerArgs();

    await expect(evaluateAndSendWebserverConfig()).resolves.toBeUndefined();
  });
});
