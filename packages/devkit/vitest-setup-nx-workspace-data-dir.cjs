// Redirect Nx's workspace-data directory to a per-run temp dir BEFORE any `nx`
// module computes its module-level `workspaceDataDirectory` const from the real
// repo root (see packages/nx/src/utils/cache-directory.ts). The real
// `nx/core/package-json` plugin (loaded by the convert-to-inferred equivalence
// oracle) reads `<workspaceDataDirectory>/package-json.hash`; without this
// override that read lands in the real repo's `.nx/workspace-data`, which is
// outside `devkit:test`'s declared task inputs and trips Nx Cloud's
// task-isolation sandbox. `absolutePath()` returns an absolute override as-is,
// so this moves the read (and its write) into a temp dir CI allows.
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { mkdtempSync, rmSync } = require('node:fs');

if (!process.env.NX_WORKSPACE_DATA_DIRECTORY) {
  const dir = mkdtempSync(join(tmpdir(), 'nx-devkit-spec-workspace-data-'));
  process.env.NX_WORKSPACE_DATA_DIRECTORY = dir;
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
}
