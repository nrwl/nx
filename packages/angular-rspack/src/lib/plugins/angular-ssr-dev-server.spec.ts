import { rspack, type Compilation } from '@rspack/core';
import { fork } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { AngularSsrDevServer } from './angular-ssr-dev-server';

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return { ...original, fork: vi.fn(original.fork) };
});

describe('AngularSsrDevServer', () => {
  it('registers the afterEmit hook only once across rebuilds', async () => {
    const compiler = rspack({ mode: 'development' });
    compiler.watchMode = true;
    new AngularSsrDevServer({
      outputPath: { browser: '/dist/browser', server: '/dist/server' },
      index: { input: 'index.html', output: 'index.html' },
    } as NormalizedAngularRspackPluginOptions).apply(compiler);

    try {
      for (let build = 0; build < 3; build++) {
        await compiler.hooks.watchRun.promise(compiler);
      }
      expect(
        compiler.hooks.afterEmit.taps.filter(
          (tap) => tap.name === 'AngularSsrDevServer'
        )
      ).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        compiler.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('starts the server after prerender finishes writing its output', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nx-angular-ssr-'));
    const index = join(directory, 'index.html');
    const release = join(directory, 'release');
    const observed = join(directory, 'observed.html');
    const compiler = rspack({ mode: 'development', context: directory });
    compiler.watchMode = true;
    vi.mocked(fork).mockClear();
    const waitForServerRead = () =>
      vi.waitFor(() => expect(existsSync(observed)).toBe(true), {
        timeout: 10_000,
      });

    try {
      writeFileSync(index, '<html><body>initial</body></html>');
      writeFileSync(
        join(directory, 'server.js'),
        `const { existsSync, readFileSync, renameSync, writeFileSync } = require('node:fs');
const interval = setInterval(() => {
  if (!existsSync(${JSON.stringify(release)})) return;
  clearInterval(interval);
  let html;
  try {
    html = readFileSync(${JSON.stringify(index)}, 'utf8');
  } catch (error) {
    html = error.code;
  }
  writeFileSync(${JSON.stringify(observed + '.tmp')}, html);
  renameSync(${JSON.stringify(observed + '.tmp')}, ${JSON.stringify(observed)});
}, 5);`
      );
      new AngularSsrDevServer({
        outputPath: { browser: directory, server: directory },
        index: { input: 'index.html', output: 'index.html' },
      } as NormalizedAngularRspackPluginOptions).apply(compiler);
      compiler.hooks.afterEmit.tapPromise('Prerender', async () => {
        const document = readFileSync(index, 'utf8');
        writeFileSync(release, '');
        if (vi.mocked(fork).mock.results.length) {
          await waitForServerRead();
        }
        writeFileSync(index, document.replace('initial', 'prerendered'));
      });

      await compiler.hooks.afterEmit.promise({ errors: [] } as Compilation);
      await waitForServerRead();

      const servedHtml = readFileSync(observed, 'utf8');
      expect(servedHtml).toContain('prerendered');
    } finally {
      try {
        await new Promise<void>((resolve, reject) => {
          compiler.close((error) => (error ? reject(error) : resolve()));
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  }, 20_000);
});
