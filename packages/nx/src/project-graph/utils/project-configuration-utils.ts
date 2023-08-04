import { basename } from 'node:path';

import { getPackageJsonWorkspacesPlugin } from '../../../plugins/package-json-workspaces';
import { getProjectJsonPlugin } from '../../../plugins/project-json';
import { NxJsonConfiguration, TargetDefaults } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import { readJsonFile } from '../../utils/fileutils';
import { NX_PREFIX } from '../../utils/logger';
import { NxPluginV2 } from '../../utils/nx-plugin';
import { workspaceRoot } from '../../utils/workspace-root';

import minimatch = require('minimatch');
export function mergeProjectConfigurationIntoProjectsConfigurations(
  // projectName -> ProjectConfiguration
  existingProjects: Record<string, ProjectConfiguration>,
  // projectRoot -> projectName
  existingProjectRootMap: Map<string, string>,
  project: ProjectConfiguration,
  // project.json is a special case, so we need to detect it.
  file: string
): void {
  let matchingProjectName = existingProjectRootMap.get(project.root);

  if (!matchingProjectName) {
    existingProjects[project.name] = project;
    existingProjectRootMap.set(project.root, project.name);
    return;
    // There are some special cases for handling project.json - mainly
    // that it should override any name the project already has.
  } else if (
    project.name &&
    project.name !== matchingProjectName &&
    basename(file) === 'project.json'
  ) {
    // Copy config to new name
    existingProjects[project.name] = existingProjects[matchingProjectName];
    // Update name in project config
    existingProjects[project.name].name = project.name;
    // Update root map to point to new name
    existingProjectRootMap[project.root] = project.name;
    // Remove entry for old name
    delete existingProjects[matchingProjectName];
    // Update name that config should be merged to
    matchingProjectName = project.name;
  }

  const matchingProject = existingProjects[matchingProjectName];

  // This handles top level properties that are overwritten. `srcRoot`, `projectType`, or fields that Nx doesn't know about.
  const updatedProjectConfiguration = {
    ...matchingProject,
    ...project,
    name: matchingProjectName,
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

  if (updatedProjectConfiguration.name !== matchingProject.name) {
    delete existingProjects[matchingProject.name];
  }
  existingProjects[updatedProjectConfiguration.name] =
    updatedProjectConfiguration;
}

export function buildProjectsConfigurationsFromProjectPathsAndPlugins(
  nxJson: NxJsonConfiguration,
  projectFiles: string[], // making this parameter allows devkit to pick up newly created projects
  plugins: NxPluginV2[],
  root: string = workspaceRoot,
  readJson: <T extends Object>(string) => T = <T extends Object>(string) =>
    readJsonFile<T>(string) // making this an arg allows us to reuse in devkit
): {
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
} {
  const projectRootMap: Map<string, string> = new Map();
  const projects: Record<string, ProjectConfiguration> = {};
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};

  // We push the nx core node builder onto the end, s.t. it overwrites any user specified behavior
  const nxCorePlugin: NxPluginV2 = getProjectJsonPlugin(readJson);
  const nxPackageManagerWorkspacesPlugin: NxPluginV2 =
    getPackageJsonWorkspacesPlugin(root, nxJson, readJson);
  plugins.push(nxPackageManagerWorkspacesPlugin, nxCorePlugin);

  // We iterate over plugins first - this ensures that plugins specified first take precedence.
  for (const plugin of plugins) {
    const [pattern, configurationConstructor] =
      plugin.projectConfigurationsConstructor ?? [];
    if (!pattern) {
      continue;
    }
    for (const file of projectFiles) {
      if (minimatch(file, pattern)) {
        const { projectNodes, externalNodes: pluginExternalNodes } =
          configurationConstructor(file, {
            projectsConfigurations: projects,
            nxJsonConfiguration: nxJson,
            workspaceRoot: root,
          });
        for (const node in projectNodes) {
          mergeProjectConfigurationIntoProjectsConfigurations(
            projects,
            projectRootMap,
            projectNodes[node],
            file
          );
        }
        Object.assign(externalNodes, pluginExternalNodes);
      }
    }
  }

  return { projects, externalNodes };
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
