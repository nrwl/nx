import { basename } from 'node:path';

import { getNxPackageJsonWorkspacesPlugin } from '../../../plugins/package-json-workspaces';
import { CreateProjectJsonProjectsPlugin } from '../../plugins/project-json/build-nodes/project-json';
import { NxJsonConfiguration, TargetDefaults } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import { NX_PREFIX } from '../../utils/logger';
import { NxPluginV2 } from '../../utils/nx-plugin';
import { workspaceRoot } from '../../utils/workspace-root';

import minimatch = require('minimatch');

export function mergeProjectConfigurationIntoRootMap(
  projectRootMap: Map<string, ProjectConfiguration>,
  project: ProjectConfiguration,
  // project.json is a special case, so we need to detect it.
  file: string
): void {
  const matchingProject = projectRootMap.get(project.root);

  if (!matchingProject) {
    projectRootMap.set(project.root, project);
    return;
  } else if (
    project.name &&
    project.name !== matchingProject.name &&
    basename(file) === 'project.json'
  ) {
    // `name` inside project.json overrides any names from
    // inference plugins
    matchingProject.name = project.name;
  }

  // This handles top level properties that are overwritten.
  // e.g. `srcRoot`, `projectType`, or other fields that shouldn't be extended
  // Note: `name` is set specifically here to keep it from changing. The name is
  // always determined by the first inference plugin to ID a project, unless it has
  // a project.json in which case it was already updated above.
  const updatedProjectConfiguration = {
    ...matchingProject,
    ...project,
    name: matchingProject.name,
  };

  // The next blocks handle properties that should be themselves merged (e.g. targets, tags, and implicit dependencies)
  if (project.tags && matchingProject.tags) {
    updatedProjectConfiguration.tags = matchingProject.tags.concat(
      project.tags
    );
  }

  if (project.implicitDependencies && matchingProject.tags) {
    updatedProjectConfiguration.implicitDependencies =
      matchingProject.implicitDependencies.concat(project.implicitDependencies);
  }

  if (project.generators && matchingProject.generators) {
    updatedProjectConfiguration.generators = {
      ...matchingProject.generators,
      ...project.generators,
    };
  }

  if (project.targets && matchingProject.targets) {
    updatedProjectConfiguration.targets = {
      ...matchingProject.targets,
      ...project.targets,
    };
  }

  projectRootMap.set(
    updatedProjectConfiguration.root,
    updatedProjectConfiguration
  );
}

export function buildProjectsConfigurationsFromProjectPathsAndPlugins(
  nxJson: NxJsonConfiguration,
  projectFiles: string[], // making this parameter allows devkit to pick up newly created projects
  plugins: NxPluginV2[],
  root: string = workspaceRoot
): {
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
} {
  const projectRootMap: Map<string, ProjectConfiguration> = new Map();
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};

  // We push the nx core node builder onto the end, s.t. it overwrites any user specified behavior
  plugins.push(
    getNxPackageJsonWorkspacesPlugin(root),
    CreateProjectJsonProjectsPlugin
  );

  // We iterate over plugins first - this ensures that plugins specified first take precedence.
  for (const plugin of plugins) {
    const [pattern, createNodes] = plugin.createNodes ?? [];
    if (!pattern) {
      continue;
    }
    for (const file of projectFiles) {
      if (minimatch(file, pattern, { dot: true })) {
        const { projects: projectNodes, externalNodes: pluginExternalNodes } =
          createNodes(file, {
            nxJsonConfiguration: nxJson,
            workspaceRoot: root,
          });
        for (const node in projectNodes) {
          projectNodes[node].name ??= node;
          mergeProjectConfigurationIntoRootMap(
            projectRootMap,
            projectNodes[node],
            file
          );
        }
        Object.assign(externalNodes, pluginExternalNodes);
      }
    }
  }

  return {
    projects: readProjectConfigurationsFromRootMap(projectRootMap),
    externalNodes,
  };
}

export function readProjectConfigurationsFromRootMap(
  projectRootMap: Map<string, ProjectConfiguration>
) {
  const projects: Record<string, ProjectConfiguration> = {};
  // If there are projects that have the same name, that is an error.
  // This object tracks name -> (all roots of projects with that name)
  // to provide better error messaging.
  const errors: Map<string, string[]> = new Map();

  for (const [root, configuration] of projectRootMap.entries()) {
    if (!configuration.name) {
      throw new Error(`Project at ${root} has no name provided.`);
    } else if (configuration.name in projects) {
      let rootErrors = errors.get(configuration.name) ?? [
        projects[configuration.name].root,
      ];
      rootErrors.push(root);
      errors.set(configuration.name, rootErrors);
    } else {
      projects[configuration.name] = configuration;
    }
  }

  if (errors.size > 0) {
    throw new Error(
      [
        `The following projects are defined in multiple locations:`,
        ...Array.from(errors.entries()).map(([project, roots]) =>
          [`- ${project}: `, ...roots.map((r) => `  - ${r}`)].join('\n')
        ),
        '',
        "To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name.",
      ].join('\n')
    );
  }
  return projects;
}

export function mergeTargetConfigurations(
  projectConfiguration: ProjectConfiguration,
  target: string,
  targetDefaults: TargetDefaults[string]
): TargetConfiguration {
  const targetConfiguration = projectConfiguration.targets?.[target];

  if (!targetConfiguration) {
    throw new Error(
      `Attempted to merge targetDefaults for ${projectConfiguration.name}.${target}, which doesn't exist.`
    );
  }

  const {
    configurations: defaultConfigurations,
    options: defaultOptions,
    ...defaults
  } = targetDefaults;
  const result = {
    ...defaults,
    ...targetConfiguration,
  };

  // Target is "compatible", e.g. executor is defined only once or is the same
  // in both places. This means that it is likely safe to merge options
  if (
    !targetDefaults.executor ||
    !targetConfiguration.executor ||
    targetDefaults.executor === targetConfiguration.executor
  ) {
    result.options = { ...defaultOptions, ...targetConfiguration?.options };
    result.configurations = mergeConfigurations(
      defaultConfigurations,
      targetConfiguration.configurations
    );
  }
  return result as TargetConfiguration;
}

function mergeConfigurations<T extends Object>(
  defaultConfigurations: Record<string, T>,
  projectDefinedConfigurations: Record<string, T>
): Record<string, T> {
  const result: Record<string, T> = {};
  const configurations = new Set([
    ...Object.keys(defaultConfigurations ?? {}),
    ...Object.keys(projectDefinedConfigurations ?? {}),
  ]);
  for (const configuration of configurations) {
    result[configuration] = {
      ...(defaultConfigurations?.[configuration] ?? ({} as T)),
      ...(projectDefinedConfigurations?.[configuration] ?? ({} as T)),
    };
  }
  return result;
}

export function resolveNxTokensInOptions<T extends Object | Array<unknown>>(
  object: T,
  project: ProjectConfiguration,
  key: string
): T {
  const result: T = Array.isArray(object) ? ([...object] as T) : { ...object };
  for (let [opt, value] of Object.entries(object ?? {})) {
    if (typeof value === 'string') {
      const workspaceRootMatch = /^(\{workspaceRoot\}\/?)/.exec(value);
      if (workspaceRootMatch?.length) {
        value = value.replace(workspaceRootMatch[0], '');
      }
      if (value.includes('{workspaceRoot}')) {
        throw new Error(
          `${NX_PREFIX} The {workspaceRoot} token is only valid at the beginning of an option. (${key})`
        );
      }
      value = value.replace(/\{projectRoot\}/g, project.root);
      result[opt] = value.replace(/\{projectName\}/g, project.name);
    } else if (typeof value === 'object' && value) {
      result[opt] = resolveNxTokensInOptions(
        value,
        project,
        [key, opt].join('.')
      );
    }
  }
  return result;
}

export function readTargetDefaultsForTarget(
  targetName: string,
  targetDefaults: TargetDefaults,
  executor?: string
): TargetDefaults[string] {
  if (executor) {
    // If an executor is defined in project.json, defaults should be read
    // from the most specific key that matches that executor.
    // e.g. If executor === run-commands, and the target is named build:
    // Use, use nx:run-commands if it is present
    // If not, use build if it is present.
    const key = [executor, targetName].find((x) => targetDefaults?.[x]);
    return key ? targetDefaults?.[key] : null;
  } else {
    // If the executor is not defined, the only key we have is the target name.
    return targetDefaults?.[targetName];
  }
}
