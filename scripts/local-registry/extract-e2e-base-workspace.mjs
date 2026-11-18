// @ts-check
/**
 * Extract one base workspace template, as its own process.
 *
 * newProject() is synchronous and tar-stream is not, so the e2e side shells out to
 * this with execFileSync rather than every call site becoming async.
 *
 * Usage: node extract-e2e-base-workspace.mjs <tarball> <destination>
 */
import { extractTarball } from './tar-utils.mjs';

const [tarball, dest] = process.argv.slice(2);
if (!tarball || !dest) {
  console.error(
    'Usage: node extract-e2e-base-workspace.mjs <tarball> <destination>'
  );
  process.exit(1);
}

await extractTarball(tarball, dest);
