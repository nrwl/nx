import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readlink,
  readdir,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_FILE_BYTES = 128 * 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_BUFFER = 64 * 1024 * 1024;
const ARCHIVE_ATTRIBUTES = '* -export-ignore -export-subst\n';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `${command} failed (${result.status})${detail ? `: ${detail}` : ''}`
    );
  }
  return result.stdout;
}

function validateTreePath(value) {
  if (!value || path.posix.isAbsolute(value))
    throw new Error(`unsafe tree path: ${value}`);
  const normalized = path.posix.normalize(value);
  if (
    normalized !== value ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`unsafe tree path: ${value}`);
  }
  return value;
}

function parseTreeEntries(output) {
  let total = 0;
  const entries = [];
  for (const record of output.split('\0')) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    if (tab < 0) throw new Error('invalid git ls-tree record');
    const [mode, type, object, sizeText] = record.slice(0, tab).split(/\s+/);
    const file = validateTreePath(record.slice(tab + 1));
    if (!mode || !type || !object || sizeText === undefined) {
      throw new Error(`invalid git ls-tree metadata for ${file}`);
    }
    const size = sizeText === '-' ? 0 : Number(sizeText);
    if (!Number.isSafeInteger(size) || size < 0)
      throw new Error(`invalid blob size for ${file}`);
    if (size > MAX_FILE_BYTES)
      throw new Error(`snapshot file exceeds 128 MiB: ${file}`);
    total += size;
    if (total > MAX_TOTAL_BYTES) throw new Error('snapshot exceeds 2 GiB');
    entries.push({ mode, type, object, size, path: file });
  }
  const folded = new Map();
  for (const entry of entries) {
    const key = entry.path.normalize('NFD').toLowerCase();
    if (folded.has(key)) {
      throw new Error(
        `snapshot has a case-insensitive path collision: ${entry.path}`
      );
    }
    folded.set(key, entry.path);
  }
  const foldedPaths = [...folded.keys()];
  for (const entry of entries.filter((item) => item.mode === '120000')) {
    const prefix = `${entry.path.normalize('NFD').toLowerCase()}/`;
    if (foldedPaths.some((candidate) => candidate.startsWith(prefix))) {
      throw new Error(`snapshot entry traverses a symlink path: ${entry.path}`);
    }
  }
  return entries;
}

export async function prepareArchiveSnapshot(gitDir) {
  const infoDir = path.join(gitDir, 'info');
  await mkdir(infoDir, { recursive: true });
  try {
    // Git's highest-precedence attributes must not transform the review tree.
    await writeFile(path.join(infoDir, 'attributes'), ARCHIVE_ATTRIBUTES, {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('refusing to replace pre-existing archive attributes');
    }
    throw error;
  }
}

async function sanitizeTree(root, relative, manifest) {
  const current = path.join(root, relative);
  const stat = await lstat(current);
  if (stat.isSymbolicLink()) {
    const target = await readlink(current);
    await unlink(current);
    await writeFile(current, `${target}\n`, { mode: 0o444 });
    manifest.push({
      path: relative.split(path.sep).join('/'),
      target,
      kind: 'symlink',
    });
    return 1;
  }
  if (stat.isDirectory()) {
    let files = 0;
    for (const entry of await readdir(current)) {
      files += await sanitizeTree(root, path.join(relative, entry), manifest);
    }
    await chmod(current, 0o555);
    return files;
  }
  if (!stat.isFile())
    throw new Error(`unsupported snapshot entry: ${relative}`);
  await chmod(current, 0o444);
  return 1;
}

export async function exportSnapshot({
  gitDir,
  ref,
  destination,
  manifestPath,
}) {
  const attributesPath = path.join(gitDir, 'info', 'attributes');
  let attributes;
  let attributesStat;
  try {
    [attributes, attributesStat] = await Promise.all([
      readFile(attributesPath, 'utf8'),
      lstat(attributesPath),
    ]);
  } catch {
    throw new Error(
      'archive attribute override missing; call prepareArchiveSnapshot first'
    );
  }
  if (
    attributes !== ARCHIVE_ATTRIBUTES ||
    !attributesStat.isFile() ||
    attributesStat.isSymbolicLink()
  ) {
    throw new Error(
      'archive attribute override missing; call prepareArchiveSnapshot first'
    );
  }
  const tree = run('git', [
    '--git-dir',
    gitDir,
    'ls-tree',
    '-r',
    '-z',
    '-l',
    ref,
  ]);
  const entries = parseTreeEntries(tree);
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination, { mode: 0o700 });
  const archive = `${destination}.tar`;
  try {
    run('git', [
      '--git-dir',
      gitDir,
      'archive',
      '--format=tar',
      `--output=${archive}`,
      ref,
    ]);
    run('tar', ['-xf', archive, '-C', destination]);

    const manifest = [];
    for (const entry of entries.filter((item) => item.type === 'commit')) {
      const target = path.join(destination, ...entry.path.split('/'));
      await rm(target, { recursive: true, force: true });
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, `${entry.object}\n`, { mode: 0o444 });
      manifest.push({
        path: entry.path,
        target: entry.object,
        kind: 'gitlink',
      });
    }
    const extractedFiles = await sanitizeTree(destination, '.', manifest);
    if (extractedFiles !== entries.length) {
      throw new Error(
        `snapshot archive contains ${extractedFiles} of ${entries.length} Git entries; archive attribute override may have failed`
      );
    }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600,
    });
    return {
      files: entries.length,
      bytes: entries.reduce((sum, item) => sum + item.size, 0),
    };
  } catch (error) {
    await makeWritableAndRemove(destination);
    throw error;
  } finally {
    await rm(archive, { force: true });
  }
}

async function makeWritable(target) {
  let stat;
  try {
    stat = await lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (stat.isDirectory()) {
    await chmod(target, 0o700);
    for (const entry of await readdir(target))
      await makeWritable(path.join(target, entry));
  } else if (!stat.isSymbolicLink()) {
    await chmod(target, 0o600);
  }
}

export async function makeWritableAndRemove(target) {
  await makeWritable(target);
  await rm(target, { recursive: true, force: true });
}
