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
  readTargetDefaultsForTarget,
  isCompatibleTarget,
  mergeTargetDefaultWithTargetDefinition,
  deepClone,
} from './target-merging';

import type { ConfigurationSourceMaps } from './source-maps';

import { existsSync } from 'node:fs';
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

function normalizeTargets(
  project: ProjectConfiguration,
  sourceMaps: ConfigurationSourceMaps,
  nxJsonConfiguration: NxJsonConfiguration,
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

    const projectSourceMaps = sourceMaps[project.root];

    const targetConfig = project.targets[targetName];
    const targetDefaults = deepClone(
      readTargetDefaultsForTarget(
        targetName,
        nxJsonConfiguration.targetDefaults,
        targetConfig.executor
      )
    );

    // We only apply defaults if they exist
    if (targetDefaults && isCompatibleTarget(targetConfig, targetDefaults)) {
      project.targets[targetName] = mergeTargetDefaultWithTargetDefinition(
        targetName,
        project,
        normalizeTarget(
          targetDefaults,
          project,
          workspaceRoot,
          projects,
          ['nx.json[targetDefaults]', targetName].join(':')
        ),
        projectSourceMaps
      );
    }

    const target = project.targets[targetName];

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
    if (
      !project.name &&
      existsSync(join(workspaceRoot, project.root, 'project.json'))
    ) {
      project.name = toProjectName(join(root, 'project.json'));
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
        projects
      );
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
    errors.push(new MultipleProjectsWithSameNameError(conflicts, projects));
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
