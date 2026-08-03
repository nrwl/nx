import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';

const PRUNE_LOCKFILE_EXECUTOR = '@nx/js:prune-lockfile';
const PNPM_LOCKFILE = 'pnpm-lock.yaml';
// The pnpm artifacts the executor emits next to the pruned lockfile. Without
// them in `outputs`, a cache replay in a clean checkout restores only the
// manifest and lockfile, silently dropping the install settings
// (pnpm-workspace.yaml), the patch files, and the vendored local-path deps.
const PNPM_PRUNE_ARTIFACTS = [
  'pnpm-workspace.yaml',
  'patches',
  'local_path_modules',
];

export default async function update(tree: Tree) {
  for (const [projectName, project] of getProjects(tree)) {
    let projectChanged = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (target.executor !== PRUNE_LOCKFILE_EXECUTOR) {
        continue;
      }
      projectChanged = appendPnpmPruneOutputs(target) || projectChanged;
    }
    if (!projectChanged) {
      continue;
    }
    updateProjectConfiguration(tree, projectName, project);
  }

  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    let defaultsChanged = false;
    for (const [key, value] of Object.entries(nxJson.targetDefaults)) {
      // a value may be the plain object form or the filtered array form
      for (const config of Array.isArray(value) ? value : [value]) {
        if (
          key !== PRUNE_LOCKFILE_EXECUTOR &&
          config.executor !== PRUNE_LOCKFILE_EXECUTOR &&
          config.filter?.executor !== PRUNE_LOCKFILE_EXECUTOR
        ) {
          continue;
        }
        defaultsChanged = appendPnpmPruneOutputs(config) || defaultsChanged;
      }
    }
    if (defaultsChanged) {
      updateNxJson(tree, nxJson);
    }
  }

  await formatFiles(tree);
}

/**
 * Appends the pnpm prune artifacts next to an existing pnpm-lock.yaml entry in
 * the target's `outputs`, reusing that entry's own path spelling so
 * hand-authored prefixes stay consistent. Targets with no `outputs` or no pnpm
 * lockfile entry are left alone.
 */
function appendPnpmPruneOutputs(target: TargetConfiguration): boolean {
  if (!target.outputs) {
    return false;
  }
  const lockfileEntry = target.outputs.find(
    (output) =>
      typeof output === 'string' &&
      (output === PNPM_LOCKFILE || output.endsWith(`/${PNPM_LOCKFILE}`))
  );
  if (!lockfileEntry) {
    return false;
  }
  const prefix = lockfileEntry.slice(0, -PNPM_LOCKFILE.length);
  let changed = false;
  for (const artifact of PNPM_PRUNE_ARTIFACTS) {
    const entry = `${prefix}${artifact}`;
    if (!target.outputs.includes(entry)) {
      target.outputs.push(entry);
      changed = true;
    }
  }
  return changed;
}
