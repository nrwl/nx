import { isDeepStrictEqual } from 'node:util';
import {
  getProjects,
  logger,
  readNxJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from 'nx/src/devkit-exports';
import {
  mergeTargetConfigurations,
  resolveNxTokensInOptions,
} from 'nx/src/devkit-internals';
import { readTargetDefaultsForTarget } from '../target-defaults-utils';

type TargetsByProject = Map<string, Record<string, TargetConfiguration>>;

export type TargetOptions = Record<string, unknown>;

export interface UninferredTargetRewrite {
  executors: string[];
  /** Names the tool in warnings, e.g. "Jest". */
  tool: string;
  /** Whether the inference plugin produces this target, given its resolved options. */
  isInferred(
    tree: Tree,
    target: TargetConfiguration,
    project: ProjectConfiguration
  ): boolean;
  /** Throws when the target has no equivalent command. */
  toRunCommandsTarget(
    target: TargetConfiguration,
    project: ProjectConfiguration
  ): TargetConfiguration;
}

/**
 * Runs `convert` after turning targets the inference plugin cannot produce into
 * explicit commands. A target that can't be rewritten is held back from the
 * converter, which would switch it to the project's default config, and
 * restored on its executor afterwards.
 */
export async function convertWithUninferredTargetsRewritten<T>(
  tree: Tree,
  rewrite: UninferredTargetRewrite,
  convert: () => Promise<T>
): Promise<T> {
  const heldBack = rewriteUninferredTargets(tree, rewrite);
  try {
    return await convert();
  } finally {
    restoreTargets(tree, heldBack);
  }
}

function rewriteUninferredTargets(
  tree: Tree,
  rewrite: UninferredTargetRewrite
): TargetsByProject {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  const heldBackByProject: TargetsByProject = new Map();
  for (const [projectName, project] of getProjects(tree)) {
    const heldBack: Record<string, TargetConfiguration> = {};
    let changed = false;
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (!rewrite.executors.includes(target.executor)) {
        continue;
      }
      const readDefaults = (executor: string) =>
        readTargetDefaultsForTarget(targetName, targetDefaults, executor, {
          projectName,
          projectNode: { name: projectName, type: 'lib', data: project },
        });
      let uninferred = false;
      try {
        const executorDefaults = readDefaults(target.executor);
        const resolved = resolveTarget(
          target,
          executorDefaults,
          project,
          `${projectName}:${targetName}`
        );
        if (rewrite.isInferred(tree, resolved, project)) {
          continue;
        }
        uninferred = true;
        const rewritten = rewrite.toRunCommandsTarget(resolved, project);
        assertDefaultsKeepTarget(
          rewritten,
          executorDefaults,
          readDefaults('nx:run-commands')
        );
        project.targets[targetName] = rewritten;
        changed = true;
      } catch (error) {
        logger.warn(
          `Could not rewrite target "${targetName}" in project "${projectName}" to run ${rewrite.tool} with its config file: ${String(error)}`
        );
        if (uninferred) {
          heldBack[targetName] = target;
          delete project.targets[targetName];
          changed = true;
        }
      }
    }
    if (changed) {
      updateProjectConfiguration(tree, projectName, project);
    }
    if (Object.keys(heldBack).length) {
      heldBackByProject.set(projectName, heldBack);
    }
  }
  return heldBackByProject;
}

function restoreTargets(tree: Tree, targetsByProject: TargetsByProject) {
  for (const [projectName, targets] of targetsByProject) {
    // Read again to keep what the converter did to sibling targets
    const project = readProjectConfiguration(tree, projectName);
    project.targets = { ...project.targets, ...targets };
    updateProjectConfiguration(tree, projectName, project);
  }
}

/**
 * The target merged with the defaults the removed executor received, with Nx
 * tokens resolved.
 */
function resolveTarget(
  target: TargetConfiguration,
  defaults: Partial<TargetConfiguration> | null,
  project: ProjectConfiguration,
  key: string
): TargetConfiguration {
  const resolved = mergeTargetConfigurations(
    structuredClone(target),
    structuredClone(defaults ?? {})
  );
  if (resolved.options) {
    resolved.options = resolveNxTokensInOptions(resolved.options, project, key);
  }
  for (const name of Object.keys(resolved.configurations ?? {})) {
    resolved.configurations[name] = resolveNxTokensInOptions(
      resolved.configurations[name],
      project,
      `${key}:${name}`
    );
  }
  return resolved;
}

/**
 * Target defaults are matched by executor, so the rewritten target can get
 * entries the removed executor never did. They must not change it.
 */
function assertDefaultsKeepTarget(
  target: TargetConfiguration,
  executorDefaults: Partial<TargetConfiguration> | null,
  runCommandsDefaults: Partial<TargetConfiguration> | null
) {
  if (!runCommandsDefaults) {
    return;
  }
  // The executor got these entries too, and the target holds their values
  // translated for the tool's CLI
  if (isDeepStrictEqual(executorDefaults, runCommandsDefaults)) {
    return;
  }
  if (
    !isDeepStrictEqual(
      withDefaults(target, runCommandsDefaults),
      withDefaults(target, {})
    )
  ) {
    throw new Error(
      'The target defaults that apply to nx:run-commands targets would change it.'
    );
  }
}

// Resolves '...' spreads too, and drops the undefined values the merge leaves
function withDefaults(
  target: TargetConfiguration,
  defaults: Partial<TargetConfiguration>
) {
  return JSON.parse(
    JSON.stringify(
      mergeTargetConfigurations(
        structuredClone(target),
        structuredClone(defaults),
        undefined,
        undefined,
        undefined,
        false
      )
    )
  );
}

// Relative, and left unchanged by sh, cmd.exe and nx:run-commands
export function isPlainPath(value: unknown): value is string {
  return typeof value === 'string' && /^[\w@+.-][\w@+./-]*$/.test(value);
}

export function assertAcceptedOptions(
  options: TargetOptions,
  accepted: Map<string, (value: unknown) => boolean>
): void {
  for (const [name, value] of Object.entries(options ?? {})) {
    if (!accepted.get(name)?.(value)) {
      throw new Error(
        `The rewrite does not accept the "${name}" option set to ${JSON.stringify(value)}.`
      );
    }
  }
}

export function optionsFor(
  target: TargetConfiguration,
  configuration?: string
): TargetOptions {
  return {
    ...target.options,
    ...(configuration ? target.configurations[configuration] : {}),
  };
}

/** Throws when an output reads an option whose value the rewrite changes. */
export function assertOutputOptionsKept(
  before: TargetConfiguration,
  after: TargetConfiguration
): void {
  const outputOptions = [
    ...(after.outputs ?? []).join(' ').matchAll(/\{options\.(\w+)/g),
  ].map(([, name]) => name);
  for (const name of [undefined, ...Object.keys(before.configurations ?? {})]) {
    const beforeOptions = optionsFor(before, name);
    const afterOptions = optionsFor(after, name);
    const changed = outputOptions.find(
      (option) =>
        !isDeepStrictEqual(beforeOptions[option], afterOptions[option])
    );
    if (changed) {
      throw new Error(
        `An output reads the "${changed}" option, which the rewrite changes.`
      );
    }
  }
}
