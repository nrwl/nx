import {
  formatFiles,
  getProjects,
  globAsync,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type ProjectGraphProjectNode,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  findMatchingConfigFiles,
  findMatchingTargetNames,
  mergeTargetConfigurations,
  readTargetDefaultsForTarget,
  resolveCommandSyntacticSugar,
} from '@nx/devkit/internal';
import { dirname } from 'path';
import {
  addPnpmDeployOutputCacheInputs,
  addPnpmDeployOutputCacheInputsToInferredTargetOverlay,
} from '../../utils/pnpm-deploy-output-cache-inputs';
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

// The config-file plugins whose inferred build target can emit the deploy
// output (NxAppWebpackPlugin/NxAppRspackPlugin with generatePackageJson).
// The globs mirror each plugin's own createNodes pattern; the commands are
// what each plugin sets on the build target it creates.
const INFERRED_DEPLOY_PLUGINS: Record<
  string,
  { configGlob: string; command: string }
> = {
  '@nx/webpack/plugin': {
    configGlob: '**/webpack.config.{js,ts,mjs,cjs}',
    command: 'webpack-cli build',
  },
  '@nx/rspack/plugin': {
    configGlob: '**/rspack.config.{js,ts,mjs,mts,cjs,cts}',
    command: 'rspack build',
  },
};

/**
 * Adds the workspace-root pnpm install settings sources to the `inputs` of
 * build targets that emit the pruned pnpm deploy output. The build approvals
 * and `supportedArchitectures` those outputs carry reach no lockfile, so
 * without these a revoked approval leaves the task hash unchanged and a cached
 * run replays an output that still grants it. Inferred targets are covered by
 * the `@nx/webpack` and `@nx/rspack` plugins themselves; this migration covers
 * the explicitly configured executor targets, plus overlays of inferred
 * targets (a project-level entry, under the exact name or a glob-pattern key
 * matching it, or a matching `targetDefaults` entry) whose replacing `inputs`
 * array discards the plugin-generated one.
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

  // Overlays of plugin-inferred build targets carry no executor, so the loop
  // above cannot see them, yet a replacing `inputs` array in one discards the
  // settings inputs the plugin generates. The plugin adds those inputs without
  // knowing whether the config enables generatePackageJson (that lives inside
  // the user's config file), so the overlay repair is equally unconditional.
  // It appends the runtime probe even where the plugin omits it under a valid
  // pnpm pin: the repair runs once and the pin can be removed later.
  for (const ref of await inferredDeployTargetOverlayRefs(
    tree,
    nxJson,
    projects
  )) {
    const changed = addPnpmDeployOutputCacheInputsToInferredTargetOverlay(
      ref,
      targetDefaults
    );
    if (changed === 'target') {
      changedProjects.add(ref.projectName);
    } else if (changed === 'defaults') {
      defaultsChanged = true;
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
 * One ref per (project, inferred build target) the registered `@nx/webpack` or
 * `@nx/rspack` config-file plugins would create, resolved the way the plugins
 * do: their createNodes glob filtered by each registration's include/exclude,
 * the config file's directory as the project root, and the registration's
 * `buildTargetName` option. The overlaying project-level entry may sit under
 * the exact target name or a glob-pattern key matching it; one that replaces
 * what the target runs disqualifies the target instead.
 */
async function inferredDeployTargetOverlayRefs(
  tree: Tree,
  nxJson: NxJsonConfiguration | null,
  projects: Map<string, ProjectConfiguration>
): Promise<MatchedTargetRef[]> {
  const rootToProject = new Map<string, string>();
  for (const [projectName, project] of projects) {
    rootToProject.set(project.root, projectName);
  }
  const refs: MatchedTargetRef[] = [];
  for (const registration of nxJson?.plugins ?? []) {
    const pluginName =
      typeof registration === 'string' ? registration : registration.plugin;
    const inferredPlugin = INFERRED_DEPLOY_PLUGINS[pluginName];
    if (!inferredPlugin) {
      continue;
    }
    const options =
      typeof registration === 'string'
        ? undefined
        : (registration.options as { buildTargetName?: string } | undefined);
    const targetName = options?.buildTargetName ?? 'build';
    const configFiles = findMatchingConfigFiles(
      await globAsync(tree, [inferredPlugin.configGlob]),
      typeof registration === 'string' ? undefined : registration.include,
      typeof registration === 'string' ? undefined : registration.exclude
    );
    for (const configFile of configFiles) {
      const projectName = rootToProject.get(dirname(configFile));
      if (!projectName) {
        continue;
      }
      const project = projects.get(projectName);
      const target = inferredTargetOverlayEntry(project.targets, targetName);
      // An entry that changes what the target runs is not an overlay; the
      // executor loop covers the deploy executors among those.
      if (
        target &&
        replacesInferredRunCommandsIdentity(
          target,
          inferredPlugin.command,
          project.root
        )
      ) {
        continue;
      }
      refs.push({
        targetName,
        projectName,
        projectNode: {
          name: projectName,
          type: 'lib',
          data: { root: project.root, tags: project.tags },
        },
        // the runtime matcher sees the plugin target's effective identity:
        // its `command` payload resolves to nx:run-commands
        matcherExecutor: 'nx:run-commands',
        // the runtime drops the plugin attribution as soon as the project
        // entry authors an executor or command, restated or not, so a
        // plugin-filtered defaults entry no longer applies to the target
        sourcePlugin:
          target?.executor !== undefined || target?.command !== undefined
            ? undefined
            : pluginName,
        target: target ?? {},
      });
    }
  }
  return refs;
}

/**
 * The project-level entry that overlays the inferred `targetName`. Its key is
 * the exact name or a glob pattern the name matches; the inferred target
 * exists before any project-level entry merges, so a matching glob key
 * overlays it too. When several keys match, each entry merges against the
 * inferred target independently and the last write wins, so only the last
 * one applies. A glob key matching an earlier same-file sibling never
 * surfaces here: the project read already collapsed it onto that sibling and
 * dropped the key.
 */
function inferredTargetOverlayEntry(
  targets: Record<string, TargetConfiguration> | undefined,
  targetName: string
): TargetConfiguration | undefined {
  const matching = Object.entries(targets ?? {}).filter(
    ([key]) =>
      key === targetName ||
      findMatchingTargetNames(key, [targetName]).length > 0
  );
  return matching[matching.length - 1]?.[1];
}

/**
 * Whether the entry changes what the inferred run-commands target runs when
 * merged, resolved with nx's own merge so `"..."` placement and restated
 * identities land the way the runtime lands them: a merged executor other
 * than nx:run-commands, an effective command differing from the plugin's, or
 * a `command`/`commands` clash the run-commands schema rejects. An entry
 * restating the identity the plugin infers is still an overlay.
 */
function replacesInferredRunCommandsIdentity(
  target: TargetConfiguration,
  inferredCommand: string,
  projectRoot: string
): boolean {
  // `command` alongside `executor` fails graph construction outright;
  // there is nothing running to repair.
  if (target.command && target.executor) {
    return true;
  }
  const merged = mergeTargetConfigurations(
    resolveCommandSyntacticSugar(target, projectRoot),
    { executor: 'nx:run-commands', options: { command: inferredCommand } }
  );
  if (merged.executor !== 'nx:run-commands') {
    return true;
  }
  // Both present fails the run-commands schema's oneOf; the target cannot run.
  if (merged.options?.command && merged.options?.commands) {
    return true;
  }
  const command =
    merged.options?.command ?? merged.options?.commands?.join(' && ');
  return command !== inferredCommand;
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
