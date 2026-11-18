// Runs @nx/js/typescript's createNodes on this repo through an isolated, traced worker, the
// way one CLI invocation would, and reports whether the evaluation cache answered.
//   npx tsx scratch/fs-trace-spike/drive-real.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { IsolatedPlugin } from '../../packages/nx/src/project-graph/plugins/isolation/isolated-plugin';
import { workspaceDataDirectory } from '../../packages/nx/src/utils/cache-directory';
import { globWithWorkspaceContext } from '../../packages/nx/src/utils/workspace-context';
import { readNxJson } from '../../packages/nx/src/config/nx-json';

const root = join(__dirname, '../..');
const entriesDir = join(workspaceDataDirectory, 'plugin-evaluations');

function newestEntry(): { file: string; mtimeMs: number } | null {
  try {
    return readdirSync(entriesDir)
      .map((f) => ({
        file: join(entriesDir, f),
        mtimeMs: statSync(join(entriesDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  } catch {
    return null;
  }
}

async function main() {
  const before = newestEntry();
  const plugin = await IsolatedPlugin.load('@nx/js/typescript', root);
  const [pattern, createNodes] = plugin.createNodes!;
  const configFiles = await globWithWorkspaceContext(root, [pattern]);
  const t0 = performance.now();
  const results = await createNodes(configFiles, {
    nxJsonConfiguration: readNxJson(root),
    workspaceRoot: root,
  });
  const ms = performance.now() - t0;
  const after = newestEntry();
  const stored = !!after && (!before || after.mtimeMs !== before.mtimeMs);
  let shape = '';
  if (after) {
    const entry = JSON.parse(readFileSync(after.file, 'utf8'));
    shape = `entry: ${entry.inputs.length} inputs, ${entry.listings?.length ?? 0} listings, ${Math.round(statSync(after.file).size / 1024)} KB`;
  }
  console.log(
    `${configFiles.length} configs, ${results.length} results, ${ms.toFixed(0)} ms, ${stored ? 'ran and stored' : 'cache hit or not stored'}; ${shape}`
  );
  plugin.shutdown?.();
  process.exit(0);
}

main();
