import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { waitForStorybookDevServer } from './dev-server-ready-check';

describe('waitForStorybookDevServer', () => {
  let dir: string;
  let port: number;
  let otherPort: number;
  let listeners: Server[];
  const cwd = process.cwd();
  const pending = Symbol('pending');

  const installStorybook = (version: string) => {
    mkdirSync(join(dir, 'node_modules/storybook'), { recursive: true });
    writeFileSync(
      join(dir, 'node_modules/storybook/package.json'),
      JSON.stringify({ name: 'storybook', version })
    );
  };
  const stubTaskOptions = (options: Record<string, unknown>) =>
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));
  const settle = (wait: Promise<void>, ms: number) =>
    Promise.race([wait, new Promise((r) => setTimeout(r, ms, pending))]);
  // `$port` is the port the server should listen on, `$other` any other
  const fill = (value: string) =>
    value.replace('$port', String(port)).replace('$other', String(otherPort));

  // Fails on a check that resolves before the dev server listens
  async function expectToWaitForPort(wait: Promise<void>) {
    expect(await settle(wait, 500)).toBe(pending);
    listeners.push(await listen(port, '127.0.0.1'));
    expect(await settle(wait, 2000)).toBeUndefined();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-storybook-ready-'));
    listeners = [];
    port = await getFreePort();
    do otherPort = await getFreePort();
    while (otherPort === port);
    for (const name of [
      'PORT',
      'SBCONFIG_PORT',
      'SBCONFIG_HOSTNAME',
      'CLAUDE_AGENT_SDK_VERSION',
      'AI_AGENT',
    ]) {
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(listeners.map(close));
  });

  it.each([
    ['10.5.0', ['-p', '$port'], { SBCONFIG_PORT: '$other', PORT: '$other' }],
    ['10.5.0', [], { SBCONFIG_PORT: '$port', PORT: '$other' }],
    ['10.5.0', [], { PORT: '$port' }],
    // A Claude preview launch
    [
      '10.5.0',
      ['--port=$other'],
      { CLAUDE_AGENT_SDK_VERSION: '1', PORT: '$port' },
    ],
    [
      '10.5.0',
      ['-p', '$port', '-h', '::1'],
      { SBCONFIG_HOSTNAME: '127.0.0.1' },
    ],
    ['10.4.6', ['--port', '$other'], { SBCONFIG_PORT: '$port' }],
    ['8.6.19', ['-p$port'], {}],
  ])(
    'waits for the port storybook %s resolves from %j and %j',
    async (version, args, env) => {
      installStorybook(version);
      for (const [name, value] of Object.entries(env)) {
        vi.stubEnv(name, fill(value));
      }
      stubTaskOptions({ args: args.map(fill) });

      await expectToWaitForPort(waitForStorybookDevServer());
    }
  );

  it.each(['8.6.19', '10.5.0'])(
    'probes nothing when storybook %s gets no port, since it picks a free one',
    async (version) => {
      installStorybook(version);
      stubTaskOptions({});

      expect(await settle(waitForStorybookDevServer(), 2000)).toBeUndefined();
    }
  );
});

function listen(port: number, host: string): Promise<Server> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject).listen(port, host, () => resolve(server));
  });
}

function close(server: Server) {
  return new Promise((r) => server.close(r));
}

async function getFreePort(): Promise<number> {
  const v4 = await listen(0, '127.0.0.1');
  const { port } = v4.address() as AddressInfo;
  // The wait also probes ::1, where a port free on 127.0.0.1 can be taken
  const v6 = await listen(port, '::1').catch((e: NodeJS.ErrnoException) => e);
  await close(v4);
  if (v6 instanceof Server) {
    await close(v6);
  } else if (v6.code === 'EADDRINUSE') {
    return getFreePort();
  }
  return port;
}
