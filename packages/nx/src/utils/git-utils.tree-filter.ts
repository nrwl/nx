/**
 * This is meant to be used with `git filter-branch --tree-filter` to rewrite
 * history to only include commits related to the source project folder. If the
 * destination folder is different, this script also moves the files over.
 *
 * Example:
 * git filter-branch --tree-filter 'node git-utils.tree-filter.js <source> <destination>' --prune-empty -- --all
 */
const { execSync } = require('child_process');
const { existsSync, mkdirSync, renameSync, rmSync } = require('fs');
const { posix } = require('path');
try {
  const src = process.argv[2];
  const dest = process.argv[3];
  const files = execSync(`git ls-files -z ${src}`)
    .toString()
    .trim()
    .split('\x00')
    .map((s) => s.trim())
    .filter(Boolean);
  const srcRegex = new RegExp(`^${src}`);
  for (const file of files) {
    if (src === '' || srcRegex.test(file)) {
      // If source and destination are the same, then keep the file as is.
      if (src === dest) continue;
      const destFile = posix.join(dest, file.replace(srcRegex, ''));
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
