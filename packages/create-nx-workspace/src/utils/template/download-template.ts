import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar-stream';
import { CnwError } from '../error-utils';

// Branches to try, in order. GitHub serves a gzipped tarball of a repo at
// https://github.com/<org>/<repo>/archive/refs/heads/<branch>.tar.gz.
const DEFAULT_BRANCHES = ['main', 'master'];

/**
 * Download an nrwl template repository as a tarball and extract it into
 * `directory`.
 *
 * Using a tarball instead of `git clone` means git is never required (fresh
 * machines, CI, and AI agents often have no git or no configured user, and
 * `git clone` can fail for many reasons). The tarball also contains no `.git`,
 * so the template can be extracted into a directory that already holds the
 * user's repository - the basis for scaffolding into the current directory.
 *
 * The directory may already exist and contain inert files; existing files
 * (e.g. README) are overwritten by the template.
 *
 * @param template GitHub repo slug, e.g. `nrwl/react-template`.
 * @param directory Absolute path to extract into.
 */
export async function downloadTemplate(
  template: string,
  directory: string
): Promise<void> {
  let body: ReadableStream<Uint8Array> | undefined;
  let lastError: unknown;
  for (const branch of DEFAULT_BRANCHES) {
    const url = `https://github.com/${template}/archive/refs/heads/${branch}.tar.gz`;
    try {
      const res = await fetch(url);
      if (res.ok && res.body) {
        body = res.body;
        break;
      }
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      lastError = e;
    }
  }

  if (!body) {
    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new CnwError(
      'TEMPLATE_CLONE_FAILED',
      `Failed to download template '${template}': ${message}`
    );
  }

  mkdirSync(directory, { recursive: true });

  try {
    await extractTarball(body, directory);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new CnwError(
      'TEMPLATE_CLONE_FAILED',
      `Failed to create starter workspace: ${message}`
    );
  }
}

async function extractTarball(
  body: ReadableStream<Uint8Array>,
  directory: string
): Promise<void> {
  const extract = tar.extract();

  extract.on('entry', (header, stream, next) => {
    // GitHub wraps everything in a top-level `<repo>-<branch>/` directory.
    // Strip that first segment so files land directly in `directory`.
    const relativePath = header.name.split('/').slice(1).join('/');

    // Top-level dir entry or unsupported type (symlink, pax header): drain
    // and move on.
    if (
      !relativePath ||
      (header.type !== 'file' && header.type !== 'directory')
    ) {
      stream.on('end', next);
      stream.resume();
      return;
    }

    const destPath = join(directory, relativePath);

    // Defense-in-depth against a malicious tarball escaping the target dir
    // (zip-slip) via `..` entries.
    const rel = relative(directory, destPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      stream.on('end', next);
      stream.resume();
      return;
    }

    if (header.type === 'directory') {
      mkdirSync(destPath, { recursive: true });
      stream.on('end', next);
      stream.resume();
      return;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    const writeStream = createWriteStream(destPath, { mode: header.mode });
    // Surface a write failure to the pipeline below so it rejects and tears
    // down every stream.
    writeStream.on('error', (err) => extract.destroy(err));
    writeStream.on('close', next);
    stream.pipe(writeStream);
  });

  // pipeline (unlike a manual .pipe() chain) forwards errors from every stage -
  // a network drop on the source or a corrupt/truncated gzip rejects here and
  // destroys all streams, so the caller can wrap it in a CnwError.
  // Cast: web ReadableStream (DOM) vs node:stream/web differ structurally.
  await pipeline(Readable.fromWeb(body as any), createGunzip(), extract);
}
