import type { ExecutorContext } from '@nx/devkit';
import type { ChildProcess } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, type AddressInfo, type Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { waitForPortOpen } from '../../utils/wait-for-port-open';
import fileServerExecutor from './file-server.impl';
import type { Schema } from './schema';

const children = vi.hoisted(() => [] as ChildProcess[]);

// The executor resolves http-server from `module.paths`, which vitest leaves empty
vi.mock('@nx/devkit/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nx/devkit/internal')>();
  return {
    ...actual,
    readModulePackageJson: (specifier: string) =>
      actual.readModulePackageJson(specifier, [__dirname]),
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    fork: (...args: Parameters<typeof actual.fork>) => {
      const child = actual.fork(...args);
      children.push(child);
      return child;
    },
  };
});

function listen(port: number, host: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer()
      .once('error', reject)
      .listen(port, host, () => resolve(server));
  });
}

const close = (server: Server) =>
  new Promise<void>((resolve) => server.close(() => resolve()));

// The cases probe 127.0.0.1 and ::1, so the port must be free on each loopback
// the host has
async function getFreePort(): Promise<number> {
  for (;;) {
    const ipv4 = await listen(0, '127.0.0.1');
    const { port } = ipv4.address() as AddressInfo;
    let free = true;
    const ipv6 = await listen(port, '::1').catch((e) => {
      if (e.code === 'EADDRINUSE') {
        free = false;
      } else if (e.code !== 'EADDRNOTAVAIL') {
        throw e;
      }
      return null;
    });
    await Promise.all([ipv4, ipv6].filter(Boolean).map(close));
    if (free) return port;
  }
}

describe('fileServerExecutor', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'file-server-'));
    writeFileSync(join(root, 'index.html'), '<html></html>');
  });

  afterEach(() => {
    children.splice(0).forEach((child) => child.kill());
    rmSync(root, { recursive: true, force: true });
  });

  const serve = (options: Partial<Schema>) =>
    fileServerExecutor(
      {
        staticFilePath: root,
        spa: false,
        parallel: false,
        withDeps: false,
        cacheSeconds: -1,
        ...options,
      },
      { root } as ExecutorContext
    );

  it.each([
    [undefined, 'localhost'],
    ['::', 'localhost'],
    ['127.0.0.1', '127.0.0.1'],
  ])(
    'with host %j, yields the url once the server listens',
    async (host, urlHost) => {
      const port = await getFreePort();
      const url = `http://${urlHost}:${port}/`;
      const executor = serve({ host, port });

      expect((await executor.next()).value).toEqual({
        success: true,
        baseUrl: url,
      });
      await expect(
        waitForPortOpen(port, { host: urlHost, retries: 0 })
      ).resolves.toBeUndefined();

      children[0].kill();
      expect(await executor.next()).toMatchObject({ done: true });
    }
  );

  it('ends without a url when the server exits before it listens', async () => {
    // No cert.pem in the served directory's cwd, so http-server exits
    const executor = serve({ ssl: true, port: await getFreePort() });

    expect(await executor.next()).toEqual({
      done: true,
      value: { success: false },
    });
  });
});
