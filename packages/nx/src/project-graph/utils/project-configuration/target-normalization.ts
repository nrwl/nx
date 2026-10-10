import { NxJsonConfiguration } from '../../../config/nx-json';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../../config/workspace-json-project-json';
import {
  getExecutorInformation,
  parseExecutor,
} from '../../../command-line/run/executor-utils';
import { readJsonFile } from '../../../utils/fileutils';
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
import { isObject, NX_SPREAD_TOKEN } from './utils';

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

/**
 * Nothing downstream rejects a key it does not know — the Rust hasher drops it,
 * the Cloud runner reads only the keys it reads, and the Kotlin API decodes with
 * `ignoreUnknownKeys`. So a typo is silent everywhere else, and this is the only
 * place a misspelled option can be reported at all. `'...'` is listed because a
 * spread with no base to resolve against survives merging.
 */
const KNOWN_ULTRACACHE_KEYS = new Set<string>([
  'mode',
  'ignoredReads',
  'ignoredWrites',
  NX_SPREAD_TOKEN,
]);

const ULTRACACHE_MODES = ['on', 'warn', 'error', 'off'] as const;

function describeUltracacheValue(value: unknown): string {
  if (Array.isArray(value)) return 'an array';
  if (value === null) return 'null';
  return `a ${typeof value}`;
}

/**
 * Describes every way an `ultracache` violates the shape the schema forbids.
 *
 * The schema is editor-only, and everything downstream — the Rust task hasher,
 * the cloud runner's Go and Kotlin deserializers — is strict. A bad value that
 * gets this far is reported far from its source, or silently drops the task's
 * tracking, so it is worth reporting here where the project, target and file
 * are all still in hand.
 *
 * Returns messages rather than throwing: only a WorkspaceValidityError is
 * collected by `validateAndNormalizeProjectRootMap`, and anything else escapes
 * as far as the daemon, which exits on an error it cannot classify.
 */
function validateTargetUltracache(
  ultracache: unknown,
  projectName: string,
  projectRoot: string,
  targetName: string,
  sourceMaps: ConfigurationSourceMaps
): string[] {
  if (ultracache === undefined) {
    return [];
  }

  const targetSourceMaps = sourceMaps?.[projectRoot];
  const [file, plugin] =
    targetSourceMaps?.[`targets.${targetName}.ultracache`] ??
    targetSourceMaps?.[`targets.${targetName}`] ??
    [];
  const origin = file
    ? ` (defined in ${file})`
    : plugin
      ? ` (defined by ${plugin})`
      : '';
  const where = `"${targetName}" in project "${projectName}"${origin}`;

  if (!isObject(ultracache)) {
    return [
      `The "ultracache" configuration for target ${where} must be an object, but it is ${describeUltracacheValue(
        ultracache
      )}.`,
    ];
  }

  const errors: string[] = [];

  for (const key of Object.keys(ultracache)) {
    if (!KNOWN_ULTRACACHE_KEYS.has(key)) {
      errors.push(
        `"ultracache.${key}" for target ${where} is not an ultracache option. Supported options are "mode", "ignoredReads" and "ignoredWrites".`
      );
    }
  }

  if (
    ultracache.mode !== undefined &&
    !ULTRACACHE_MODES.includes(ultracache.mode as any)
  ) {
    const supported = ULTRACACHE_MODES.map((mode) => `"${mode}"`).join(', ');
    errors.push(
      `"ultracache.mode" for target ${where} must be one of ${supported}, but it is ${
        typeof ultracache.mode === 'string'
          ? `"${ultracache.mode}"`
          : describeUltracacheValue(ultracache.mode)
      }.`
    );
  }

  for (const key of ['ignoredReads', 'ignoredWrites'] as const) {
    const value = ultracache[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      errors.push(
        `"ultracache.${key}" for target ${where} must be an array of glob patterns, but it is ${describeUltracacheValue(
          value
        )}.`
      );
      continue;
    }
    const badIndex = value.findIndex((glob) => typeof glob !== 'string');
    if (badIndex !== -1) {
      errors.push(
        `"ultracache.${key}[${badIndex}]" for target ${where} must be a glob pattern string, but it is ${describeUltracacheValue(
          value[badIndex]
        )}.`
      );
    }
  }

  return errors;
}

function normalizeTargets(
  project: ProjectConfiguration,
  sourceMaps: ConfigurationSourceMaps,
  workspaceRoot: string,
  /**
   * Project configurations keyed by project name
   */
  projects: Record<string, ProjectConfiguration>
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

    targetErrorMessage.push(
      ...validateTargetUltracache(
        target.ultracache,
        project.name ?? project.root,
        project.root,
        targetName,
        sourceMaps
      ).map((message) => `- ${message}`)
    );

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
      normalizeTargets(project, sourceMaps, workspaceRoot, projects);
    } catch (e) {
      if (e instanceof WorkspaceValidityError) {
        validityErrors.push(e);
      } else {
        throw e;
      }
    }
  }

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
