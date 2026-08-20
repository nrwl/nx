import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
} from '@nx/devkit/internal';
import { addPnpmDeployOutputCacheInputs } from '../../utils/pnpm-deploy-output-cache-inputs';
import {
  compatibleDefaultsEntries,
  resolveDefaultsExecutor,
  selectDefaultsKey,
  type MatchedTargetRef,
} from '../../utils/target-defaults-matching';

// The executors that emit the pruned pnpm deploy output (lockfile,
// settings-only pnpm-workspace.yaml, patches, vendored local paths), each with
// the option that turns the emission on. webpack, rspack, vite and esbuild
// gate it on `generatePackageJson`; next, remix, tsc and swc emit the manifest
// regardless and gate only the deploy output on `generateLockfile`.
const DEPLOY_OUTPUT_EXECUTORS: Record<
  string,
  'generatePackageJson' | 'generateLockfile'
> = {
  '@nx/webpack:webpack': 'generatePackageJson',
  '@nx/rspack:rspack': 'generatePackageJson',
  '@nx/vite:build': 'generatePackageJson',
  '@nx/esbuild:esbuild': 'generatePackageJson',
  '@nx/next:build': 'generateLockfile',
  '@nx/remix:build': 'generateLockfile',
  '@nx/js:tsc': 'generateLockfile',
  '@nx/js:swc': 'generateLockfile',
};

/**
 * Adds the workspace-root pnpm install settings sources to the `inputs` of
 * build targets that emit the pruned pnpm deploy output. The build approvals
 * and `supportedArchitectures` those outputs carry reach no lockfile, so
 * without these a revoked approval leaves the task hash unchanged and a cached
 * run replays an output that still grants it. Inferred targets are covered by
 * the `@nx/webpack` and `@nx/rspack` plugins themselves; this migration covers
 * the explicitly configured executor targets.
 */
export default async function update(tree: Tree) {
  // The deploy output's install settings are pnpm-specific; other package
  // managers' outputs hash everything they are built from already.
  if (!tree.exists('pnpm-lock.yaml')) {
    return;
  }
  const nxJson = readNxJson(tree);
  const targetDefaults = nxJson?.targetDefaults;
  const projects = new Map<string, ProjectConfiguration>();
  const changedProjects = new Set<string>();
  let defaultsChanged = false;
  for (const [projectName, project] of getProjects(tree)) {
    projects.set(projectName, project);
    const projectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: 'lib',
      data: { root: project.root, tags: project.tags },
    };
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      // The executor may come from a matching targetDefaults entry rather
      // than the target itself. A `command` target resolves to nx:run-commands
      // before defaults apply, so a default can never re-identify it.
      const executor =
        target.executor ??
        (target.command
          ? 'nx:run-commands'
          : resolveDefaultsExecutor(
              targetName,
              projectName,
              projectNode,
              targetDefaults
            ));
      if (!executor || !DEPLOY_OUTPUT_EXECUTORS[executor]) {
        continue;
      }
      const ref: MatchedTargetRef = {
        targetName,
        projectName,
        projectNode,
        matcherExecutor: target.executor,
        target,
      };
      const selectedKey = targetDefaults
        ? selectDefaultsKey(ref, targetDefaults, executor)
        : null;
      const entries = compatibleDefaultsEntries(
        ref,
        selectedKey,
        targetDefaults
      );
      const defaults = entries.length
        ? readTargetDefaultsForTarget(
            targetName,
            { [selectedKey]: entries },
            ref.matcherExecutor,
            { projectName, projectNode }
          )
        : null;
      // The effective view, not the target's own: the gating option may be
      // supplied by a matching defaults entry or set only in a configuration.
      const effective = mergeTargetConfigurations(target, defaults ?? {});
      if (!emitsDeployOutput(effective, DEPLOY_OUTPUT_EXECUTORS[executor])) {
        continue;
      }
      const changed = addPnpmDeployOutputCacheInputs(
        ref,
        targetDefaults,
        executor
      );
      if (changed === 'target') {
        changedProjects.add(projectName);
      } else if (changed === 'defaults') {
        defaultsChanged = true;
      }
    }
  }

  for (const projectName of changedProjects) {
    updateProjectConfiguration(tree, projectName, projects.get(projectName));
  }
  if (defaultsChanged) {
    updateNxJson(tree, nxJson);
  }

  await formatFiles(tree);
}

/**
 * Whether the target ships the deploy output in any of its runs: the gating
 * option can sit in `options` or in any configuration, and `inputs` cannot
 * vary per configuration, so one enabled configuration is enough.
 */
function emitsDeployOutput(
  effective: TargetConfiguration,
  gate: 'generatePackageJson' | 'generateLockfile'
): boolean {
  return (
    Boolean(effective.options?.[gate]) ||
    Object.values(effective.configurations ?? {}).some((configuration) =>
      Boolean(configuration?.[gate])
    )
  );
}
