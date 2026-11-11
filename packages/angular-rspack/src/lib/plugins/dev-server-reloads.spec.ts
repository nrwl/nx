import { rspack, sources, type Compiler, type DevServer } from '@rspack/core';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevServerReloads } from './dev-server-reloads';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) {
    await cleanups.pop()?.();
  }
});

async function startHarness(devServer: DevServer) {
  const dir = await mkdtemp(join(tmpdir(), 'ngrs-dev-server-reloads-'));
  await writeFile(join(dir, 'browser.js'), `console.log('PAGE-v1');\n`);
  await writeFile(join(dir, 'document.html'), '<p>v1</p>');
  // Files newer than the watch start rebuild once more at startup.
  const past = new Date(Date.now() - 60_000);
  for (const file of ['browser.js', 'document.html']) {
    await utimes(join(dir, file), past, past);
  }

  const compiler = rspack({
    mode: 'development',
    context: dir,
    devtool: false,
    target: 'web',
    entry: './browser.js',
    output: { path: join(dir, 'dist') },
    devServer,
    watchOptions: { aggregateTimeout: 5 },
    plugins: [
      // Emits a document at processAssets, as IndexHtmlPlugin does.
      (compiler: Compiler) => {
        compiler.hooks.thisCompilation.tap('test', (compilation) => {
          compilation.hooks.processAssets.tapPromise('test', async () => {
            const document = join(dir, 'document.html');
            compilation.fileDependencies.add(document);
            compilation.emitAsset(
              'index.html',
              new sources.RawSource(await readFile(document, 'utf-8'))
            );
          });
        });
      },
      (compiler: Compiler) => new DevServerReloads().apply(compiler),
    ],
  });

  const sendMessage = vi.fn();
  (compiler.options.devServer || {}).setupMiddlewares?.([], {
    webSocketServer: { clients: [{}] },
    sendMessage,
  } as never);

  let edited: string | undefined;
  let editSeen = false;
  let onEditInvalid: (() => void) | undefined;
  let editDone: (() => void) | undefined;
  compiler.hooks.invalid.tap('test', () => {
    const callback = onEditInvalid;
    onEditInvalid = undefined;
    callback?.();
  });
  compiler.hooks.watchRun.tap('test', (running) => {
    if (edited && running.modifiedFiles?.has(edited)) {
      editSeen = true;
    }
  });
  compiler.hooks.done.tap('test', () => {
    if (editSeen) {
      editSeen = false;
      edited = undefined;
      editDone?.();
    }
  });
  const firstBuild = new Promise<void>((resolve) =>
    compiler.hooks.done.tap('test', () => resolve())
  );
  const watching = compiler.watch({ aggregateTimeout: 5 }, () => {});
  cleanups.push(async () => {
    await new Promise<void>((resolve) => watching.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  await firstBuild;

  return {
    sendMessage,
    /** Writes a source file and waits for the build it starts. */
    edit(file: string, content: string): Promise<void> {
      const path = join(dir, file);
      return new Promise<void>((resolve, reject) => {
        // rspack's native watcher misses writes made before it subscribes,
        // which can be after the previous build is done.
        let retry: ReturnType<typeof setTimeout> | undefined;
        const write = () => {
          writeFile(path, content).catch(reject);
          retry = setTimeout(write, 1000);
        };
        edited = path;
        onEditInvalid = () => clearTimeout(retry);
        editDone = resolve;
        write();
      });
    },
  };
}

describe('DevServerReloads', () => {
  it.each([
    ['a document edit', 'document.html', '<p>v2</p>', {}, 1],
    ['a page edit', 'browser.js', `console.log('PAGE-v2');\n`, {}, 0],
    // The client reloads on the hash change by itself.
    [
      'a document edit with hot off',
      'document.html',
      '<p>v2</p>',
      { hot: false },
      0,
    ],
    [
      'a document edit with live reload off',
      'document.html',
      '<p>v2</p>',
      { liveReload: false },
      0,
    ],
  ])(
    'counts the reloads the dev server misses after %s',
    async (_, file, content, devServer, reloads) => {
      const harness = await startHarness(devServer);

      await harness.edit(file, content);

      expect(
        harness.sendMessage.mock.calls.filter(
          ([, type]) => type === 'static-changed'
        )
      ).toHaveLength(reloads);
    },
    20_000
  );
});
