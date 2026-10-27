/**
 * This is meant to be used with `git filter-branch --tree-filter` to rewrite
 * history to only include commits related to the source project folder. If the
 * destination folder is different, this script also moves the files over.
 *
 * Example:
 * NX_IMPORT_SOURCE=<source> NX_IMPORT_DESTINATION=<destination> git filter-branch --tree-filter 'node git-utils.tree-filter.js' --prune-empty -- --all
 */
const { execFileSync } = require('child_process');
const {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
} = require('fs');

// Paths are raw bytes so names that are not valid UTF-8 move unchanged.
const SLASH = 0x2f;

function split(path, separator) {
  const parts = [];
  let start = 0;
  for (let i = 0; i <= path.length; i++) {
    if (i === path.length || path[i] === separator) {
      if (i > start) parts.push(path.subarray(start, i));
      start = i + 1;
    }
  }
  return parts;
}

function joinPath(parts) {
  const joined = [];
  for (const part of parts) {
    if (joined.length) joined.push(Buffer.from('/'));
    joined.push(part);
  }
  return Buffer.concat(joined);
}

// Creates the missing directories of `parts` and refuses to pass through
// anything that is not a real directory.
function ensureRealDir(parts) {
  for (let i = 1; i <= parts.length; i++) {
    const current = joinPath(parts.slice(0, i));
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      mkdirSync(current);
      continue;
    }
    if (!stats.isDirectory()) {
      throw new Error(`${current.toString()} is not a directory`);
    }
  }
}

function removeEmptyDirs(path) {
  if (!lstatSync(path).isDirectory()) return;
  for (const entry of readdirSync(path, { encoding: 'buffer' })) {
    removeEmptyDirs(joinPath([path, entry]));
  }
  try {
    rmdirSync(path);
  } catch (error) {
    if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error;
  }
}

try {
  // NOTE: Using env vars because Windows PowerShell has its own handling of quotes (") messes up quotes in args, even if escaped.
  // NOTE: The paths passed to `git filter-branch` are POSIX.
  const src = process.env.NX_IMPORT_SOURCE;
  const dest = process.env.NX_IMPORT_DESTINATION;
  if (src !== dest) {
    const srcParts = split(Buffer.from(src), SLASH);
    const files = split(
      execFileSync('git', ['ls-files', '-z', '--', ...(src ? [src] : [])], {
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 1024,
      }),
      0
    );

    // Move everything into a fresh directory first, so the destination is
    // created in a tree that no longer holds any imported entries.
    const staging = Buffer.from(mkdtempSync('.nx-import-'));
    const leftovers = [];
    for (const file of files) {
      const parts = split(file, SLASH);
      const inSource = srcParts.every((part, i) => parts[i]?.equals(part));
      ensureRealDir(parts.slice(0, -1));
      if (inSource) {
        const target = [staging, ...parts.slice(srcParts.length)];
        ensureRealDir(target.slice(0, -1));
        renameSync(file, joinPath(target));
      } else {
        rmSync(file);
      }
      if (parts.length > 1) leftovers.push(parts[0].toString('hex'));
    }
    for (const leftover of new Set(leftovers)) {
      removeEmptyDirs(Buffer.from(leftover, 'hex'));
    }

    const destParts = split(Buffer.from(dest), SLASH);
    if (destParts.length) {
      ensureRealDir(destParts.slice(0, -1));
      renameSync(staging, joinPath(destParts));
    } else {
      for (const entry of readdirSync(staging, { encoding: 'buffer' })) {
        renameSync(joinPath([staging, entry]), entry);
      }
      rmdirSync(staging);
    }
  }
} catch (error) {
  console.error(`Error executing Git commands: ${error}`);
  process.exit(1);
}
