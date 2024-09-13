/**
 * This is meant to be used with `git filter-branch --index-filter` to rewrite
 * history such that only commits related to the subdirectory is kept.
 *
 * Example:
 * git filter-branch --index-filter 'node git-utils.index-filter.js "packages/foo"' --prune-empty -- --all
 */
try {
  const { execSync } = require('child_process');
  execSync('git read-tree --empty', { stdio: 'inherit' });
  execSync(`git reset ${process.env.GIT_COMMIT} -- "${process.argv[2]}"`, {
    stdio: 'inherit',
  });
} catch (error) {
  console.error(`Error executing Git commands: ${error}`);
  process.exit(1);
}
