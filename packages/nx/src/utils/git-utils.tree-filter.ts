/**
 * This is meant to be used with `git filter-branch --tree-filter` to rewrite
 * history to only include commits related to the source project folder. If the
 * destination folder is different, this script also moves the files over.
 *
 * Example:
 * NX_IMPORT_SOURCE=<source> NX_IMPORT_DESTINATION=<destination> git filter-branch --tree-filter 'node git-utils.tree-filter.js' --prune-empty -- --all
 */
const { execSync } = require('child_process');
const { existsSync, mkdirSync, renameSync, rmSync } = require('fs');
// NOTE: The path passed to `git filter-branch` is POSIX, so we need to use the `posix` module.
const { posix } = require('path');
try {
  // NOTE: Using env vars because Windows PowerShell has its own handling of quotes (") messes up quotes in args, even if escaped.
  const src = process.env.NX_IMPORT_SOURCE;
  const dest = process.env.NX_IMPORT_DESTINATION;
  const files = execSync(`git ls-files -z ${src}`, {
    windowsHide: true,
  })
    .toString()
    .trim()
    .split('\x00')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const file of files) {
    if (src === '' || file.startsWith(src)) {
      // If source and destination are the same, then keep the file as is.
      if (src === dest) continue;
      const destFile = posix.join(dest, file.replace(src, ''));
      const dir = posix.dirname(destFile);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      renameSync(file, destFile);
    } else {
      // If not matching the source we are filtering, remove it.
      rmSync(file);
    }
  }
} catch (error) {
  console.error(`Error executing Git commands: ${error}`);
  process.exit(1);
}
