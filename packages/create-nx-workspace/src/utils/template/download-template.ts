import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar-stream';
import { CnwError } from '../error-utils';

// Branches to try, in order. GitHub serves a gzipped tarball of a repo at
// https://github.com/<org>/<repo>/archive/refs/heads/<branch>.tar.gz.
const DEFAULT_BRANCHES = ['main', 'master'];

/**
 * Download an nrwl template repository and extract it into `directory`.
 *
 * git is not required (fresh machines / CI / AI agents may have none), and an
 * existing `.git` in `directory` is left intact, so this can scaffold into the
 * current directory. Existing files (e.g. README) are overwritten.
 *
 * @param template GitHub repo slug, e.g. `nrwl/react-template`.
 * @param directory Absolute path to extract into.
 */
export async function downloadTemplate(
  template: string,
  directory: string
): Promise<void> {
  let body: ReadableStream<Uint8Array> | undefined;
  const attempts: string[] = [];
  // 404 means the repo/branch does not exist; any other failure (thrown fetch,
  // 403 from a sandbox proxy, 407/429/5xx) means blocked or failed egress.
  // The distinction picks the error code and its hints.
  let networkError = false;
  for (const branch of DEFAULT_BRANCHES) {
    const url = `https://github.com/${template}/archive/refs/heads/${branch}.tar.gz`;
    try {
      const res = await fetch(url);
      if (res.ok && res.body) {
        body = res.body;
        break;
      }
      if (res.status !== 404) networkError = true;
      attempts.push(`${branch}: HTTP ${res.status}`);
    } catch (e) {
      networkError = true;
      attempts.push(`${branch}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!body) {
    if (networkError) {
      throw new CnwError(
        'NETWORK_ERROR',
        `Failed to download template '${template}' (${attempts.join('; ')}).\n` +
          `github.com may be blocked or unreachable in this environment. Check your network and sandbox configuration and try again, or run with --preset=empty (instead of --template) to create a minimal workspace without downloading a template.`
      );
    }
    throw new CnwError(
      'TEMPLATE_CLONE_FAILED',
      `Failed to download template '${template}' (${attempts.join('; ')}). Check that the template name is correct.`
    );
  }

  // Only remove the directory on failure if we created it - never delete a
  // pre-existing dir (e.g. the user's current directory).
  const dirPreexisted = existsSync(directory);
  mkdirSync(directory, { recursive: true });

  try {
    await extractTarball(body, directory);
  } catch (e) {
    if (!dirPreexisted) {
      rmSync(directory, { recursive: true, force: true });
    }
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
    // Drain the entry and move to the next one without writing anything.
    const skip = () => {
      stream.on('end', next);
      stream.resume();
    };

    try {
      // GitHub wraps everything in a top-level `<repo>-<branch>/` directory.
      // Strip that first segment so files land directly in `directory`.
      const relativePath = header.name.split('/').slice(1).join('/');

      // Top-level dir entry or unsupported type (symlink, pax header).
      if (
        !relativePath ||
        (header.type !== 'file' && header.type !== 'directory')
      ) {
        return skip();
      }

      const destPath = join(directory, relativePath);

      // Defense-in-depth against a malicious tarball escaping the target dir
      // (zip-slip) via `..` entries.
      const rel = relative(directory, destPath);
      if (rel.startsWith('..') || isAbsolute(rel)) {
        return skip();
      }

      if (header.type === 'directory') {
        mkdirSync(destPath, { recursive: true });
        return skip();
      }

      mkdirSync(dirname(destPath), { recursive: true });
      const writeStream = createWriteStream(destPath, { mode: header.mode });
      // Surface a write failure to the pipeline below so it rejects and tears
      // down every stream.
      writeStream.on('error', (err) => extract.destroy(err));
      writeStream.on('close', next);
      stream.pipe(writeStream);
    } catch (err) {
      // A synchronous failure here (e.g. mkdirSync hitting EACCES/ENOSPC, or a
      // path component that is a file) would otherwise escape the awaited
      // pipeline; route it so the operation rejects instead of crashing.
      extract.destroy(err as Error);
    }
  });

  // pipeline (unlike a manual .pipe() chain) forwards errors from every stage -
  // a network drop on the source or a corrupt/truncated gzip rejects here and
  // destroys all streams, so the caller can wrap it in a CnwError.
  // Cast: the global (DOM) ReadableStream and node:stream/web differ structurally.
  await pipeline(
    Readable.fromWeb(body as NodeWebReadableStream<Uint8Array>),
    createGunzip(),
    extract
  );
}
