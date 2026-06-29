import {
  detectPackageManager,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';

const PRUNE_LOCKFILE_EXECUTOR = '@nx/js:prune-lockfile';

export default async function migrate(tree: Tree) {
  // Only pnpm emits a `pnpm-workspace.yaml` alongside the pruned lockfile; other
  // package managers never produce one, so there is nothing to capture.
  if (detectPackageManager(tree.root) !== 'pnpm') {
    return;
  }

  let changed = false;
  for (const [projectName, project] of getProjects(tree)) {
    let projectChanged = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (target.executor !== PRUNE_LOCKFILE_EXECUTOR) {
        continue;
      }

      const outputs = target.outputs;
      if (
        !Array.isArray(outputs) ||
        outputs.some((output) => output.endsWith('pnpm-workspace.yaml'))
      ) {
        continue;
      }

      // Anchor on the existing package.json output so the workspace file lands
      // in the same dist directory, whatever the configured output path is.
      const packageJsonOutput = outputs.find((output) =>
        output.endsWith('/package.json')
      );
      if (!packageJsonOutput) {
        continue;
      }

      target.outputs = [
        ...outputs,
        packageJsonOutput.replace(/package\.json$/, 'pnpm-workspace.yaml'),
      ];
      projectChanged = true;
    }

    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, project);
      changed = true;
    }
  }

  if (changed) {
    await formatFiles(tree);
  }
}
