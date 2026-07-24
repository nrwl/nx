import { readdirSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserOutputServerAssets } from './server-assets';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readdirSync: vi.fn(actual.readdirSync) };
});

describe('createBrowserOutputServerAssets', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  async function createBrowserOutput(
    files: Record<string, string>
  ): Promise<string> {
    root = await mkdtemp(join(tmpdir(), 'server-assets-'));
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(root, name), content);
    }
    return root;
  }

  it('should map the index html and include stylesheets when critical CSS inlining is enabled', async () => {
    const dir = await createBrowserOutput({
      'index.html': '<html></html>',
      'styles.css': 'body{}',
      'main.js': '',
    });

    const assets = createBrowserOutputServerAssets(dir, 'index.html', true);

    expect(Object.keys(assets).sort()).toEqual([
      'index.csr.html',
      'index.html',
      'index.server.html',
      'styles.css',
    ]);
    await expect(assets['index.server.html'].text()).resolves.toBe(
      '<html></html>'
    );
    expect(assets['styles.css'].size).toBe(6);
    expect(assets['styles.css'].hash).toEqual(expect.any(String));
  });

  it('should skip stylesheets when critical CSS inlining is disabled', async () => {
    const dir = await createBrowserOutput({
      'index.html': '<html></html>',
      'styles.css': 'body{}',
    });

    const assets = createBrowserOutputServerAssets(dir, 'index.html', false);

    expect(Object.keys(assets).sort()).toEqual([
      'index.csr.html',
      'index.html',
      'index.server.html',
    ]);
  });

  it('should return no assets when the browser output does not exist', () => {
    const assets = createBrowserOutputServerAssets(
      join(tmpdir(), 'server-assets-missing'),
      'index.html',
      true
    );

    expect(assets).toEqual({});
  });

  it('should throw when the browser output cannot be listed', async () => {
    const dir = await createBrowserOutput({ 'not-a-dir': '' });

    expect(() =>
      createBrowserOutputServerAssets(
        join(dir, 'not-a-dir'),
        'index.html',
        true
      )
    ).toThrow();
  });

  it('should drop assets removed between the listing and the stat', async () => {
    const dir = await createBrowserOutput({ 'index.html': '<html></html>' });
    vi.mocked(readdirSync).mockReturnValueOnce([
      'index.html',
      'ghost.css',
    ] as unknown as ReturnType<typeof readdirSync>);

    const assets = createBrowserOutputServerAssets(dir, 'index.html', true);

    expect(Object.keys(assets).sort()).toEqual([
      'index.csr.html',
      'index.html',
      'index.server.html',
    ]);
  });
});
