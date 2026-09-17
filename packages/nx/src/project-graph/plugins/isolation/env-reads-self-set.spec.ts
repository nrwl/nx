import { execSync } from 'child_process';
import { join } from 'path';
import { isSelfSet } from './env-reads';

/**
 * Keys Nx writes, yet records: each one is real workspace input that happens to
 * have a writer somewhere, so a plugin reading it should be held to it.
 */
const RECORDED_ANYWAY: Record<string, string> = {
  INIT_CWD: 'Only a generator testing utility writes it.',
  NODE_PATH: 'Written by `nx migrate`, and it decides module resolution.',
  NX_CLOUD_API: 'Written by `nx login`, from the user who ran it.',
  NX_DAEMON: 'Written once by `nx init`; otherwise the user sets it.',
  NX_ISOLATE_PLUGINS: 'Written once by `nx init`; otherwise the user sets it.',
  TS_NODE_COMPILER_OPTIONS:
    "Derived from the workspace's tsconfig, which is a recorded source file.",
};

describe('the keys Nx writes into its own environment', () => {
  it('are each either left out of a record or classified as input', () => {
    const src = join(__dirname, '../../..');
    // Sources rather than an import graph: this has to see a write added
    // anywhere in the package, including the ones a plugin load never reaches.
    // Tests are left out, since setting a variable is how they arrange one.
    const found = execSync(
      String.raw`grep -rhoE "process\.env\.[A-Z_0-9]+ *=[^=]" . --include='*.ts' ` +
        String.raw`--exclude='*.spec.ts' --exclude-dir=internal-testing-utils | ` +
        String.raw`sed -E 's/process\.env\.([A-Z_0-9]+).*/\1/' | sort -u`,
      { cwd: src, encoding: 'utf-8' }
    )
      .split('\n')
      .filter(Boolean);

    // A sanity check on the grep itself, so a shape change that matches nothing
    // fails here rather than passing as a clean result.
    expect(found).toContain('NX_TUI');

    const unclassified = found.filter(
      (key) => !isSelfSet(key) && !(key in RECORDED_ANYWAY)
    );

    // Nx rewrites what it writes, per command. A plugin that reads one without
    // asking, as `@nx/eslint` and `@nx/jest` read `NX_TUI`, would have its
    // record invalidated on the next command of a different shape. Adding the
    // key to SELF_SET_KEYS keeps it out of records; adding it to
    // RECORDED_ANYWAY says it is real input and explains why.
    expect(unclassified).toEqual([]);
  });
});
