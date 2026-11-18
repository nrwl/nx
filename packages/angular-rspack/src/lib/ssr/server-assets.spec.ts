import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerAssets } from './server-assets';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readdirSync: vi.fn(actual.readdirSync) };
});

describe('createServerAssets', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });

  async function createOutput(
    files: Record<string, string>
  ): Promise<{ server: string; browser: string }> {
    root = await mkdtemp(join(tmpdir(), 'server-assets-'));
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), content);
    }
    return { server: join(root, 'server'), browser: join(root, 'browser') };
  }

  it('should map the index documents and include stylesheets when critical CSS inlining is enabled', async () => {
    const { server, browser } = await createOutput({
      'server/index.server.html': '<html>server</html>',
      'server/index.csr.html': '<html>csr</html>',
      'browser/styles.css': 'body{}',
      'browser/main.js': '',
    });

    const assets = createServerAssets(server, browser, true);

    expect(Object.keys(assets).sort()).toEqual([
      'index.csr.html',
      'index.server.html',
      'styles.css',
    ]);
    await expect(assets['index.server.html'].text()).resolves.toBe(
      '<html>server</html>'
    );
    await expect(assets['index.csr.html'].text()).resolves.toBe(
      '<html>csr</html>'
    );
    await expect(assets['styles.css'].text()).resolves.toBe('body{}');
  });

  it('should skip stylesheets when critical CSS inlining is disabled', async () => {
    const { server, browser } = await createOutput({
      'server/index.server.html': '<html></html>',
      'server/index.csr.html': '<html></html>',
      'browser/styles.css': 'body{}',
    });

    const assets = createServerAssets(server, browser, false);

    expect(Object.keys(assets).sort()).toEqual([
      'index.csr.html',
      'index.server.html',
    ]);
  });

  it('should return no assets when the outputs do not exist', () => {
    const missing = join(tmpdir(), 'server-assets-missing');

    const assets = createServerAssets(
      join(missing, 'server'),
      join(missing, 'browser'),
      true
    );

    expect(assets).toEqual({});
  });

  it('should throw when the browser output cannot be listed', async () => {
    const { server, browser } = await createOutput({ browser: '' });

    expect(() => createServerAssets(server, browser, true)).toThrow();
  });

  it('should drop assets removed between the listing and the stat', async () => {
    const { server, browser } = await createOutput({
      'server/index.server.html': '<html></html>',
      'server/index.csr.html': '<html></html>',
    });
    vi.mocked(readdirSync).mockReturnValueOnce([
      'ghost.css',
    ] as unknown as ReturnType<typeof readdirSync>);

    const assets = createServerAssets(server, browser, true);

    expect(Object.keys(assets).sort()).toEqual([
      'index.csr.html',
      'index.server.html',
    ]);
  });

  it('should not cache a failed content read', async () => {
    const { server, browser } = await createOutput({
      'server/index.server.html': '<html></html>',
    });
    const assets = createServerAssets(server, browser, false);
    await rm(join(server, 'index.server.html'));

    await expect(assets['index.server.html'].text()).rejects.toThrow();

    await writeFile(join(server, 'index.server.html'), '<html></html>');
    await expect(assets['index.server.html'].text()).resolves.toBe(
      '<html></html>'
    );
  });
});
