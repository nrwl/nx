import {
  NxJsonConfiguration,
  TargetDefaults,
  TargetDefaultValue,
} from '../../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import {
  getExecutorInformation,
  parseExecutor,
} from '../../../command-line/run/executor-utils';
import { readJsonFile } from '../../../utils/fileutils';
import { isLongRunningTargetName } from '../../../utils/long-running-target';
import { output } from '../../../utils/output';
import { toProjectName } from '../../../config/to-project-name';
import {
  isProjectWithExistingNameError,
  isProjectWithNoNameError,
  MultipleProjectsWithSameNameError,
  ProjectsWithNoNameError,
  ProjectWithExistingNameError,
  ProjectWithNoNameError,
  WorkspaceValidityError,
} from '../../error-types';
import {
  resolveCommandSyntacticSugar,
  resolveNxTokensInOptions,
} from './target-merging';

import type { ConfigurationSourceMaps } from './source-maps';

import { existsSync } from 'node:fs';
import { analyzeWorktreeConflicts } from '../../../utils/git-worktrees';
import { join } from 'path';

export function validateProject(
  project: ProjectConfiguration,
  // name -> project
  knownProjects: Record<string, ProjectConfiguration>
) {
  if (!project.name) {
    try {
      const { name } = readJsonFile(join(project.root, 'package.json'));
      if (!name) {
        throw new Error(`Project at ${project.root} has no name provided.`);
      }
      project.name = name;
    } catch {
      throw new ProjectWithNoNameError(project.root);
    }
  } else if (
    knownProjects[project.name] &&
    knownProjects[project.name].root !== project.root
  ) {
    throw new ProjectWithExistingNameError(project.name, project.root);
  }
}

/**
 * Expand's `command` syntactic sugar, replaces tokens in options, and adds information from executor schema.
 * @param target The target to normalize
 * @param project The project that the target belongs to
 * @returns The normalized target configuration
 */
export function normalizeTarget(
  target: TargetConfiguration,
  project: ProjectConfiguration,
  workspaceRoot: string,
  projectsMap: Record<string, ProjectConfiguration>,
  errorMsgKey: string
) {
  target = {
    ...target,
    configurations: {
      ...target.configurations,
    },
  };

  target = resolveCommandSyntacticSugar(target, project.root);

  target.options = resolveNxTokensInOptions(
    target.options,
    project,
    errorMsgKey
  );

  for (const configuration in target.configurations) {
    target.configurations[configuration] = resolveNxTokensInOptions(
      target.configurations[configuration],
      project,
      `${project.root}:${target}:${configuration}`
    );
  }

  target.parallelism ??= true;

  if (target.executor && !('continuous' in target)) {
    try {
      const [executorNodeModule, executorName] = parseExecutor(target.executor);

      const { schema } = getExecutorInformation(
        executorNodeModule,
        executorName,
        workspaceRoot,
        projectsMap
      );

      if (schema.continuous) {
        target.continuous ??= schema.continuous;
      }
    } catch (e) {
      // If the executor is not found, we assume that it is not a valid executor.
      // This means that we should not set the continuous property.
      // We could throw an error here, but it would be better to just ignore it.
    }
  }

  return target;
}

// TODO(v24): remove the legacy target-name cache fallback and its warning.
// Removal needs a second mechanism for plugin-inferred targets, which the
// accompanying migration cannot reach.
/**
 * Whether `target` is cacheable only by way of the legacy name-based fallback:
 * the exact target-name key of `targetDefaults` declares `cache: true`, but an
 * executor key won target-default resolution instead, so the merged target never
 * received it.
 *
 * A `true` result means the user's `cache: true` silently lost, so this doubles
 * as the condition for warning them that the name key is being shadowed.
 */
function isLegacyCachedTarget(
  targetName: string,
  targetDefaults: TargetDefaults | undefined,
  target: TargetConfiguration
): boolean {
  // Resolution already decided `cache`, so the name key isn't shadowed.
  if (target.cache !== undefined) {
    return false;
  }

  if (isLongRunningTarget(targetName, target)) {
    return false;
  }

  // Restricted to shadowing, which is narrower than what pre-23 restored: that
  // derivation matched on target name alone, so a name key dropped as
  // incompatible (its entry declared a foreign executor) was cacheable too.
  // Restoring that as well would mean writing `cache` with no key to name in
  // the warning, and no migration able to retire it. Deliberately not covered.
  if (!findShadowingTargetDefaultKey(targetDefaults, target)) {
    return false;
  }

  return declaresCacheTrue(targetDefaults?.[targetName]);
}

/**
 * Whether the name key declares `cache: true` on an entry that always applies.
 *
 * Filters are deliberately not evaluated. They cannot express a pre-23 config
 * (the filtered array shape postdates the behavior being restored), and a
 * filtered entry declaring `cache` may or may not apply to this project — so
 * rather than guess, a filtered `cache` declares the value unknowable and
 * nothing is restored. Among unfiltered entries the last wins, matching the
 * in-key merge order.
 */
function declaresCacheTrue(value: TargetDefaultValue | undefined): boolean {
  if (!value) {
    return false;
  }
  const entries = Array.isArray(value) ? value : [value];
  let declared: boolean | undefined;
  for (const entry of entries) {
    // `nx.json` is hand-edited; a null or scalar entry would throw here.
    if (!entry || typeof entry !== 'object') continue;
    if (entry.cache === undefined) continue;
    if (entry.filter) return false;
    declared = entry.cache;
  }
  return declared === true;
}

/**
 * The normalization-time half of the pre-23 `longRunningTask` guard, which kept
 * `cacheableOperations` from ever making these cacheable. Its remaining clause
 * — `task.overrides['watch']` — is a runtime invocation override with no target
 * equivalent, so it has no counterpart here.
 */
function isLongRunningTarget(
  targetName: string,
  target: TargetConfiguration
): boolean {
  return !!target.continuous || isLongRunningTargetName(targetName);
}

/**
 * The `targetDefaults` key that beat the target-name key for `target`. Only an
 * executor key can: key precedence puts the exact target name ahead of every
 * glob, so nothing else outranks it. Undefined when the name key lost for
 * another reason (e.g. its entry declared a foreign executor and was dropped as
 * incompatible) — see {@link isLegacyCachedTarget} for why that case is left
 * alone even though pre-23 restored it.
 *
 * `hasOwnProperty` rather than a lookup: an executor named `__proto__` resolves
 * through the prototype chain to a truthy object, which would report a key the
 * user never wrote.
 */
function findShadowingTargetDefaultKey(
  targetDefaults: TargetDefaults | undefined,
  target: TargetConfiguration
): string | undefined {
  return target.executor &&
    targetDefaults &&
    Object.prototype.hasOwnProperty.call(targetDefaults, target.executor)
    ? target.executor
    : undefined;
}

/**
 * Emits a single grouped warning for every (shadowing key, target-name key)
 * pair that relied on the deprecated fallback. Grouping matters because the
 * same pair recurs in every affected project — a per-target warning would
 * print hundreds of identical lines in a large workspace.
 */
function warnAboutLegacyCachedTargets(
  legacyCacheReads: Map<string, Set<string>>
) {
  if (legacyCacheReads.size === 0) {
    return;
  }

  const bodyLines: string[] = [];
  for (const [shadowingKey, targetKeys] of legacyCacheReads) {
    for (const targetKey of targetKeys) {
      bodyLines.push(
        `  - "${shadowingKey}" does not set "cache", so it was read from "${targetKey}"`
      );
    }
  }
  bodyLines.push(
    '',
    'An executor key applies to every target that resolves through it, so exclude any continuous target before setting "cache" on one — a target that is both cacheable and continuous is rejected.',
    'Target defaults resolve to a single key rather than merging, so an executor key hides the target name key entirely.',
    'Set "cache" on the executor key to keep these targets cacheable — reading it from the target name key is deprecated and will be removed in Nx 24.'
  );

  output.warn({
    title: 'Some targets are only cacheable through a deprecated fallback.',
    bodyLines,
  });
}

function normalizeTargets(
  project: ProjectConfiguration,
  sourceMaps: ConfigurationSourceMaps,
  nxJsonConfiguration: NxJsonConfiguration,
  workspaceRoot: string,
  /**
   * Project configurations keyed by project name
   */
  projects: Record<string, ProjectConfiguration>,
  /**
   * Shadowing `targetDefaults` key -> target name keys its `cache` was read
   * from. Accumulated across projects so the deprecation warns once per pair.
   */
  legacyCacheReads: Map<string, Set<string>>
) {
  const targetErrorMessage: string[] = [];

  for (const targetName in project.targets) {
    project.targets[targetName] = normalizeTarget(
      project.targets[targetName],
      project,
      workspaceRoot,
      projects,
      [project.root, targetName].join(':')
    );

    const target = project.targets[targetName];

    const targetDefaults = nxJsonConfiguration.targetDefaults;
    if (isLegacyCachedTarget(targetName, targetDefaults, target)) {
      target.cache = true;

      // Always defined: `isLegacyCachedTarget` returns false without it.
      const shadowingKey = findShadowingTargetDefaultKey(
        targetDefaults,
        target
      );
      const targetKeys = legacyCacheReads.get(shadowingKey) ?? new Set();
      targetKeys.add(targetName);
      legacyCacheReads.set(shadowingKey, targetKeys);
    }

    if (
      // If the target has no executor or command, it doesn't do anything
      !target.executor &&
      !target.command
    ) {
      // But it may have dependencies that do something
      if (target.dependsOn && target.dependsOn.length > 0) {
        target.executor = 'nx:noop';
      } else {
        // If it does nothing, and has no depenencies,
        // we can remove it.
        delete project.targets[targetName];
      }
    }

    if (target.cache && target.continuous) {
      targetErrorMessage.push(
        `- "${targetName}" has both "cache" and "continuous" set to true. Continuous targets cannot be cached. Please remove the "cache" property.`
      );
    }
  }
  if (targetErrorMessage.length > 0) {
    targetErrorMessage.unshift(
      `Errors detected in targets of project "${project.name}":`
    );
    throw new WorkspaceValidityError(targetErrorMessage.join('\n'));
  }
}

export function validateAndNormalizeProjectRootMap(
  workspaceRoot: string,
  projectRootMap: Record<string, ProjectConfiguration>,
  nxJsonConfiguration: NxJsonConfiguration,
  sourceMaps: ConfigurationSourceMaps = {}
) {
  // Name -> Project, used to validate that all projects have unique names
  const projects: Record<string, ProjectConfiguration> = {};
  // If there are projects that have the same name, that is an error.
  // This object tracks name -> (all roots of projects with that name)
  // to provide better error messaging.
  const conflicts = new Map<string, string[]>();
  const projectRootsWithNoName: string[] = [];
  const validityErrors: WorkspaceValidityError[] = [];
  const legacyCacheReads = new Map<string, Set<string>>();

  for (const root in projectRootMap) {
    const project = projectRootMap[root];
    // We're setting `// targets` as a comment `targets` is empty due to Project Crystal.
    // Strip it before returning configuration for usage.
    if (project['// targets']) delete project['// targets'];

    // We initially did this in the project.json plugin, but
    // that resulted in project.json files without names causing
    // the resulting project to change names from earlier plugins...
    if (!project.name) {
      const projectJsonPath = join(workspaceRoot, project.root, 'project.json');
      if (existsSync(projectJsonPath)) {
        // The project.json plugin may not have run (e.g. when a single
        // plugin is run in isolation via `addPlugin` from a generator), so
        // prefer the name declared in project.json before deriving one from
        // the directory name.
        let nameFromProjectJson: string | undefined;
        try {
          nameFromProjectJson =
            readJsonFile<ProjectConfiguration>(projectJsonPath).name;
        } catch {}
        project.name =
          nameFromProjectJson ?? toProjectName(join(root, 'project.json'));
      }
    }

    try {
      validateProject(project, projects);
      projects[project.name] = project;
    } catch (e) {
      if (isProjectWithNoNameError(e)) {
        projectRootsWithNoName.push(e.projectRoot);
      } else if (isProjectWithExistingNameError(e)) {
        const rootErrors = conflicts.get(e.projectName) ?? [
          projects[e.projectName].root,
        ];
        rootErrors.push(e.projectRoot);
        conflicts.set(e.projectName, rootErrors);
      } else {
        throw e;
      }
    }
  }

  for (const root in projectRootMap) {
    const project = projectRootMap[root];
    try {
      normalizeTargets(
        project,
        sourceMaps,
        nxJsonConfiguration,
        workspaceRoot,
        projects,
        legacyCacheReads
      );
    } catch (e) {
      if (e instanceof WorkspaceValidityError) {
        validityErrors.push(e);
      } else {
        throw e;
      }
    }
  }

  warnAboutLegacyCachedTargets(legacyCacheReads);

  const errors: Error[] = [];

  if (conflicts.size > 0) {
    // Only on the way to throwing, so a workspace without duplicates never
    // pays for reading git's worktree registry.
    const worktreeAdvice = analyzeWorktreeConflicts(workspaceRoot, conflicts);
    errors.push(
      new MultipleProjectsWithSameNameError(
        conflicts,
        projects,
        worktreeAdvice ?? undefined
      )
    );
  }
  if (projectRootsWithNoName.length > 0) {
    errors.push(new ProjectsWithNoNameError(projectRootsWithNoName, projects));
  }
  if (validityErrors.length > 0) {
    errors.push(...validityErrors);
  }
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
  return projectRootMap;
}
