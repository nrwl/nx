import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { gzipSync } from 'zlib';
import * as tar from 'tar-stream';
import { downloadTemplate } from './download-template';
import { CnwError } from '../error-utils';

/**
 * Build a gzipped tarball shaped like a GitHub source archive: every entry is
 * nested under a top-level `<repo>-<branch>/` directory that the downloader is
 * expected to strip.
 */
async function makeGitHubTarball(
  topDir: string,
  files: Record<string, string>
): Promise<Buffer> {
  const pack = tar.pack();
  pack.entry({ name: `${topDir}/`, type: 'directory' });
  for (const [name, content] of Object.entries(files)) {
    pack.entry({ name: `${topDir}/${name}` }, content);
  }
  pack.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(Buffer.from(chunk));
  }
  return gzipSync(Buffer.concat(chunks));
}

// Build a gzipped tarball from arbitrary entries (for symlink / zip-slip cases
// that makeGitHubTarball's file-only shape can't express).
async function gzipPack(build: (pack: any) => void): Promise<Buffer> {
  const pack = tar.pack();
  build(pack);
  pack.finalize();
  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(Buffer.from(chunk));
  }
  return gzipSync(Buffer.concat(chunks));
}

function toWebStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

function okResponse(buf: Buffer) {
  return { ok: true, status: 200, body: toWebStream(buf) };
}

const notFound = { ok: false, status: 404, body: null };

describe('downloadTemplate', () => {
  let tmpDir: string;
  let target: string;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cnw-dl-'));
    target = join(tmpDir, 'out');
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('downloads, strips the top dir, and extracts files (incl. nested)', async () => {
    const tarball = await makeGitHubTarball('react-template-main', {
      'package.json': '{"name":"tmpl"}',
      'src/index.ts': 'export const a = 1;\n',
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/main.tar.gz') ? okResponse(tarball) : notFound
    );

    await downloadTemplate('nrwl/react-template', target);

    expect(readFileSync(join(target, 'package.json'), 'utf-8')).toBe(
      '{"name":"tmpl"}'
    );
    expect(readFileSync(join(target, 'src/index.ts'), 'utf-8')).toBe(
      'export const a = 1;\n'
    );
    // The wrapping `react-template-main/` directory must be stripped.
    expect(existsSync(join(target, 'react-template-main'))).toBe(false);
  });

  it('falls back to the master branch when main is missing', async () => {
    const tarball = await makeGitHubTarball('legacy-template-master', {
      'package.json': '{"name":"legacy"}',
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/master.tar.gz') ? okResponse(tarball) : notFound
    );

    await downloadTemplate('nrwl/legacy-template', target);

    expect(readFileSync(join(target, 'package.json'), 'utf-8')).toBe(
      '{"name":"legacy"}'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('overwrites an existing README but leaves other files (e.g. .git) intact', async () => {
    mkdirSync(target, { recursive: true });
    mkdirSync(join(target, '.git'));
    writeFileSync(join(target, '.git', 'config'), 'user-repo\n');
    writeFileSync(join(target, 'README.md'), 'old readme\n');

    const tarball = await makeGitHubTarball('empty-template-main', {
      'README.md': 'new readme\n',
      'nx.json': '{}',
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/main.tar.gz') ? okResponse(tarball) : notFound
    );

    await downloadTemplate('nrwl/empty-template', target);

    expect(readFileSync(join(target, 'README.md'), 'utf-8')).toBe(
      'new readme\n'
    );
    expect(readFileSync(join(target, 'nx.json'), 'utf-8')).toBe('{}');
    // Pre-existing user files not in the tarball are preserved.
    expect(readFileSync(join(target, '.git', 'config'), 'utf-8')).toBe(
      'user-repo\n'
    );
  });

  it('throws TEMPLATE_CLONE_FAILED when no branch resolves', async () => {
    fetchMock.mockResolvedValue(notFound);

    await expect(
      downloadTemplate('nrwl/missing-template', target)
    ).rejects.toMatchObject({ code: 'TEMPLATE_CLONE_FAILED' });
    await expect(
      downloadTemplate('nrwl/missing-template', target)
    ).rejects.toBeInstanceOf(CnwError);
  });

  it('wraps a corrupt/non-gzip body in TEMPLATE_CLONE_FAILED instead of crashing', async () => {
    // A 200 response whose body is not valid gzip (truncated download, an HTML
    // rate-limit page). Must reject cleanly, not raise an uncaught exception.
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/main.tar.gz')
        ? {
            ok: true,
            status: 200,
            body: toWebStream(Buffer.from([1, 2, 3, 4])),
          }
        : notFound
    );

    await expect(
      downloadTemplate('nrwl/react-template', target)
    ).rejects.toMatchObject({ code: 'TEMPLATE_CLONE_FAILED' });
  });

  it('falls back to master when the main request throws (network error)', async () => {
    const tarball = await makeGitHubTarball('legacy-template-master', {
      'package.json': '{"name":"legacy"}',
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/main.tar.gz')) {
        throw new Error('ECONNRESET');
      }
      return okResponse(tarball);
    });

    await downloadTemplate('nrwl/legacy-template', target);

    expect(readFileSync(join(target, 'package.json'), 'utf-8')).toBe(
      '{"name":"legacy"}'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not write entries that escape the target directory (zip-slip)', async () => {
    const tarball = await gzipPack((pack) => {
      pack.entry({ name: 'react-template-main/', type: 'directory' });
      pack.entry({ name: 'react-template-main/package.json' }, '{"ok":true}');
      // After stripping the top dir this resolves to ../evil.txt (outside target).
      pack.entry({ name: 'react-template-main/../evil.txt' }, 'pwned');
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/main.tar.gz') ? okResponse(tarball) : notFound
    );

    await downloadTemplate('nrwl/react-template', target);

    expect(readFileSync(join(target, 'package.json'), 'utf-8')).toBe(
      '{"ok":true}'
    );
    // The traversal entry must not land outside `target`.
    expect(existsSync(join(tmpDir, 'evil.txt'))).toBe(false);
  });

  it('skips symlink entries without failing', async () => {
    const tarball = await gzipPack((pack) => {
      pack.entry({ name: 'react-template-main/', type: 'directory' });
      pack.entry({ name: 'react-template-main/package.json' }, '{"ok":true}');
      pack.entry({
        name: 'react-template-main/link',
        type: 'symlink',
        linkname: '/etc/passwd',
      });
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/main.tar.gz') ? okResponse(tarball) : notFound
    );

    await downloadTemplate('nrwl/react-template', target);

    expect(existsSync(join(target, 'package.json'))).toBe(true);
    expect(existsSync(join(target, 'link'))).toBe(false);
  });
});
