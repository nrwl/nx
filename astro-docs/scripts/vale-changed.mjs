/**
 * Run Vale on all docs files.
 *
 * Exit codes mirror Vale: 1 = errors found (fail CI), 0 = warnings/suggestions only or clean.
 */
import { execSync } from 'child_process';

try {
  execSync('vale src/content/docs/', { stdio: 'inherit' });
} catch (err) {
  if (err.status === 1) {
    console.log(
      '\nVale found errors. Fix all error-level violations before committing.'
    );
    process.exit(1);
  }
  // Exit code 2 = warnings/suggestions only — don't fail
  process.exit(0);
}
