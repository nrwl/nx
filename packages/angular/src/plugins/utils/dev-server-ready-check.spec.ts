import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  getDevServerAddress,
  waitForAngularDevServer,
  type AngularWorkspace,
} from './dev-server-ready-check';

const DEVKIT_DEV_SERVER = '@angular-devkit/build-angular:dev-server';
const BUILD_DEV_SERVER = '@angular/build:dev-server';

describe('getDevServerAddress', () => {
  let root: string;

  const writeAngularBuild = (version: string) => {
    const dir = join(root, 'node_modules/@angular/build');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@angular/build', version })
    );
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-angular-ready-'));
    vi.stubEnv('PORT', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  // The expected values are what the CLI's yargs setup parses from the args
  it.each([
    [{ args: ['--port', '5000'] }, { port: 5000, host: 'dev.local' }],
    [{ args: '--port=5000 --host=0.0.0.0' }, { port: 5000 }],
    [
      { __unparsed__: ['--port', '1', '--port=5000'] },
      { port: 5000, host: 'dev.local' },
    ],
    [{ args: ['-c', 'production'] }, { port: 4400, host: 'dev.local' }],
    [{ args: ['-oc', 'a,b'] }, { port: 4600 }],
    [{ args: ['--', '--port', '5000'] }, { port: 4300, host: 'dev.local' }],
    [{ args: ['--no-port'] }, null],
  ])('reads the flags ng serve parses from %j', (options, address) => {
    const workspace: AngularWorkspace = {
      projects: {
        app: {
          root: 'projects/app',
          projectType: 'application',
          architect: {
            serve: {
              builder: DEVKIT_DEV_SERVER,
              options: { port: 4300, host: 'dev.local' },
              configurations: {
                production: { port: 4400 },
                a: { port: 4500, host: '0.0.0.0' },
                b: { port: 4600 },
              },
            },
          },
        },
      },
    };

    expect(
      getDevServerAddress({ command: 'ng serve', ...options }, workspace, root)
    ).toEqual(address);
  });

  it.each([
    ['ng serve', {}, 4301],
    ['ng serve', { args: ['-c', 'production'] }, 4302],
    ['ng serve', { args: ['--project', 'other'] }, 4400],
    ['ng serve other', { args: ['--project', 'root'] }, 4400],
    ['ng serve --open other', {}, 4400],
    ['ng serve --ssl-key other', {}, 4301],
    ['ng serve --allowed-hosts a other', {}, 4301],
    ['ng serve --allowed-hosts=a other', {}, 4301],
    ['ng serve missing', {}, null],
    ['ng run root:serve:production', {}, 4302],
    ['ng run other:serve-alt', {}, 4401],
    ['ng run missing:serve', {}, null],
    ['vite', {}, null],
  ])(
    'resolves the target and configuration %s runs with %j',
    (command, options, port) => {
      const target = (port: number) => ({
        builder: DEVKIT_DEV_SERVER,
        options: { port },
      });
      const workspace: AngularWorkspace = {
        projects: {
          other: {
            root: 'projects/other',
            projectType: 'application',
            architect: { serve: target(4400), 'serve-alt': target(4401) },
          },
          root: {
            root: '',
            projectType: 'application',
            architect: {
              serve: {
                ...target(4300),
                defaultConfiguration: 'development',
                configurations: {
                  development: { port: 4301 },
                  production: { port: 4302 },
                },
              },
            },
          },
        },
      };

      expect(
        getDevServerAddress({ command, ...options }, workspace, root)
      ).toEqual(port === null ? null : { port });
    }
  );

  it.each([
    // From 22, @angular/build lets a numeric PORT win over the flag
    [BUILD_DEV_SERVER, '22.1.2', '5100', ['--port', '5000'], {}, 5100],
    [BUILD_DEV_SERVER, '22.1.2', 'abc', [], { port: 4300 }, 4300],
    [BUILD_DEV_SERVER, '21.2.27', '5100', ['--port', '5000'], {}, 5000],
    [DEVKIT_DEV_SERVER, '22.1.2', '5100', [], {}, 4200],
    [
      '@angular-devkit/build-angular:ssr-dev-server',
      undefined,
      undefined,
      ['--host', 'dev.local'],
      { port: 4300 },
      4300,
    ],
    ['@foo/bar:dev-server', undefined, undefined, [], { port: 4300 }, null],
  ])(
    'resolves the port of %s %s with PORT=%s, %j and %j',
    (builder, version, env, args, options, port) => {
      if (version) writeAngularBuild(version);
      vi.stubEnv('PORT', env);
      const workspace: AngularWorkspace = {
        projects: {
          app: {
            root: '',
            projectType: 'application',
            architect: { serve: { builder, options } },
          },
        },
      };

      expect(
        getDevServerAddress({ command: 'ng serve', args }, workspace, root)
      ).toEqual(port === null ? null : { port });
    }
  );
});

describe('waitForAngularDevServer', () => {
  let dir: string;
  let port: number;
  let otherPort: number;
  let listeners: Server[];
  const cwd = process.cwd();
  const pending = Symbol('pending');

  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const stubTaskOptions = (options: Record<string, unknown>) =>
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));
  const settle = (wait: Promise<void>, ms: number) =>
    Promise.race([wait, new Promise((r) => setTimeout(r, ms, pending))]);

  // Fails on a check that resolves before the dev server listens
  async function expectToWaitForPort(wait: Promise<void>) {
    expect(await settle(wait, 500)).toBe(pending);
    listeners.push(await listen(port, '127.0.0.1'));
    expect(await settle(wait, 2000)).toBeUndefined();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-angular-ready-'));
    listeners = [];
    port = await getFreePort();
    do otherPort = await getFreePort();
    while (otherPort === port);
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(listeners.map(close));
  });

  it('waits for the port of the default configuration in angular.json', async () => {
    write(
      'angular.json',
      JSON.stringify({
        projects: {
          app: {
            root: '',
            architect: {
              serve: {
                builder: DEVKIT_DEV_SERVER,
                options: { port: otherPort },
                defaultConfiguration: 'development',
                configurations: { development: { port } },
              },
            },
          },
        },
      })
    );
    stubTaskOptions({ command: 'ng serve' });

    await expectToWaitForPort(waitForAngularDevServer('angular.json'));
  });
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
