/**
 * This is meant to be used with `git filter-branch --index-filter` to rewrite
 * history such that only commits related to the subdirectory is kept.
 *
 * Example:
 * NX_IMPORT_SOURCE=<source> git filter-branch --index-filter 'node git-utils.index-filter.js' --prune-empty -- --all
 */
try {
  const { execSync } = require('child_process');
  // NOTE: Using env vars because Windows PowerShell has its own handling of quotes (") messes up quotes in args, even if escaped.
  const src = process.env.NX_IMPORT_SOURCE;
  execSync('git read-tree --empty', { stdio: 'inherit', windowsHide: true });
  execSync(`git reset ${process.env.GIT_COMMIT} -- "${src}"`, {
    stdio: 'inherit',
    windowsHide: true,
  });
} catch (error) {
  console.error(`Error executing Git commands: ${error}`);
  process.exit(1);
}
