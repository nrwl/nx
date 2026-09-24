// @ts-check
/**
 * tar-stream pack/extract for the e2e base workspace templates.
 *
 * Symlinks are stored and restored by their link text: pnpm's node_modules is a web
 * of relative links, and resolving them would both explode the size and strand every
 * link on extract.
 */
import {
  createReadStream,
  createWriteStream,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { extract as tarExtract, pack as tarPack } from 'tar-stream';

/**
 * @param {string} root
 * @param {string} rel
 * @returns {Generator<string>}
 */
function* walk(root, rel = '') {
  // withFileTypes reports a symlink as a symlink, so the recursion below never
  // follows one out of the tree.
  for (const dirent of readdirSync(join(root, rel), { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${dirent.name}` : dirent.name;
    yield relPath;
    if (dirent.isDirectory() && !dirent.isSymbolicLink()) {
      yield* walk(root, relPath);
    }
  }
}

/**
 * @param {import('tar-stream').Pack} pack
 * @param {import('tar-stream').Headers} header
 * @param {string} [source]
 */
function addEntry(pack, header, source) {
  return new Promise((resolve, reject) => {
    const entry = pack.entry(header, (err) =>
      err ? reject(err) : resolve(undefined)
    );
    if (!source) {
      return;
    }
    const read = createReadStream(source);
    read.on('error', reject);
    read.pipe(entry);
  });
}

/**
 * @param {string} dir directory whose contents become the archive root
 * @param {string} dest
 */
export async function packDirectory(dir, dest) {
  const pack = tarPack();
  mkdirSync(dirname(dest), { recursive: true });
  const written = pipeline(pack, createWriteStream(dest));

  for (const relPath of walk(dir)) {
    const absPath = join(dir, relPath);
    const stats = lstatSync(absPath);
    const shared = { mode: stats.mode, mtime: stats.mtime };
    if (stats.isSymbolicLink()) {
      await addEntry(pack, {
        ...shared,
        name: relPath,
        type: 'symlink',
        linkname: readlinkSync(absPath),
      });
    } else if (stats.isDirectory()) {
      await addEntry(pack, { ...shared, name: relPath, type: 'directory' });
    } else if (stats.isFile()) {
      await addEntry(
        pack,
        { ...shared, name: relPath, type: 'file', size: stats.size },
        absPath
      );
    }
    // Sockets, fifos and devices have no business in a workspace; skip them
    // rather than fail the whole template.
  }

  pack.finalize();
  await written;
}

/**
 * @param {string} tarball
 * @param {string} dest
 */
export async function extractTarball(tarball, dest) {
  const extract = tarExtract();

  extract.on('entry', (header, stream, next) => {
    const target = join(dest, header.name);
    if (header.type === 'directory') {
      mkdirSync(target, { recursive: true });
      stream.on('end', next);
      stream.resume();
      return;
    }
    mkdirSync(dirname(target), { recursive: true });
    if (header.type === 'symlink') {
      // No existence check: the target is often another entry later in the
      // archive, and a dangling link is repaired as the rest is written.
      symlinkSync(header.linkname, target);
      stream.on('end', next);
      stream.resume();
      return;
    }
    const write = createWriteStream(target, { mode: header.mode });
    write.on('close', next);
    stream.pipe(write);
  });

  mkdirSync(dest, { recursive: true });
  await pipeline(createReadStream(tarball), extract);
}
