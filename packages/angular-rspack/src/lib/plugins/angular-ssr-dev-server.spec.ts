import { rspack, type Compilation } from '@rspack/core';
import { fork } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
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

vi.mock('../utils/misc-helpers', () => ({
  loadEsmModule: () => import('parse5-html-rewriting-stream'),
}));

describe('AngularSsrDevServer', () => {
  it('starts the server after prerender preserves reload clients in its outputs', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'nx-angular-ssr-'));
    const index = join(directory, 'index.html');
    const originalIndex = join(directory, 'index.original.html');
    const routeIndex = join(directory, 'about', 'index.html');
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
        renameSync(index, originalIndex);
        writeFileSync(release, '');
        if (vi.mocked(fork).mock.results.length) {
          await waitForServerRead();
        }
        mkdirSync(join(directory, 'about'));
        writeFileSync(routeIndex, document.replace('initial', 'about'));
        writeFileSync(index, document.replace('initial', 'prerendered'));
      });

      await compiler.hooks.afterEmit.promise({ errors: [] } as Compilation);
      await waitForServerRead();

      const servedHtml = readFileSync(observed, 'utf8');
      expect(servedHtml).toContain('prerendered');
      for (const html of [
        servedHtml,
        readFileSync(originalIndex, 'utf8'),
        readFileSync(routeIndex, 'utf8'),
      ]) {
        expect(
          html.match(/<script id="nx-angular-ssr-reload"/g) ?? []
        ).toHaveLength(1);
      }
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
