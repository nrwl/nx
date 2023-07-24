import { existsSync } from 'fs';
import * as path from 'path';
import { basename, dirname, join } from 'path';
import { workspaceRoot } from '../utils/workspace-root';
import { readJsonFile, readYamlFile } from '../utils/fileutils';
import { NX_PREFIX } from '../utils/logger';
import {
  loadNxPlugins,
  loadNxPluginsSync,
  NxPluginV2,
} from '../utils/nx-plugin';
import minimatch = require('minimatch');

import type { NxJsonConfiguration, TargetDefaults } from './nx-json';
import { readNxJson } from './nx-json';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
  TargetConfiguration,
} from './workspace-json-project-json';
import { PackageJson } from '../utils/package-json';
import { output } from '../utils/output';
import { joinPathFragments } from '../utils/path';
import {
  mergeAngularJsonAndProjects,
  shouldMergeAngularProjects,
} from '../adapter/angular-json';
import { retrieveProjectConfigurationPaths } from '../project-graph/utils/retrieve-workspace-files';
import { ProjectGraphExternalNode } from './project-graph';
import { combineGlobPatterns } from '../utils/globs';
import {
  getGlobPatternsFromPackageManagerWorkspaces,
  getPackageJsonWorkspacesPlugin,
} from '../../plugins/package-json-workspaces';
import { getProjectJsonPlugin } from '../../plugins/project-json';

export class Workspaces {
  private cachedProjectsConfig: ProjectsConfigurations;

  constructor(private root: string) {}

  /**
   * @deprecated
   */
  readProjectsConfigurations(opts?: {
    _includeProjectsFromAngularJson?: boolean;
  }): ProjectsConfigurations {
    if (
      this.cachedProjectsConfig &&
      process.env.NX_CACHE_PROJECTS_CONFIG !== 'false'
    ) {
      return this.cachedProjectsConfig;
    }
    const nxJson = readNxJson(this.root);
    const projectPaths = retrieveProjectConfigurationPaths(this.root, nxJson);
    let projectsConfigurations = buildProjectsConfigurationsFromProjectPaths(
      nxJson,
      projectPaths,
      this.root,
      (path) => readJsonFile(join(this.root, path))
    ).projects;
    if (
      shouldMergeAngularProjects(
        this.root,
        opts?._includeProjectsFromAngularJson
      )
    ) {
      projectsConfigurations = mergeAngularJsonAndProjects(
        projectsConfigurations,
        this.root
      );
    }
    this.cachedProjectsConfig = {
      version: 2,
      projects: this.mergeTargetDefaultsIntoProjectDescriptions(
        projectsConfigurations,
        nxJson
      ),
    };
    return this.cachedProjectsConfig;
  }

  /**
   * Deprecated. Use readProjectsConfigurations
   */
  readWorkspaceConfiguration(opts?: {
    _ignorePluginInference?: boolean;
    _includeProjectsFromAngularJson?: boolean;
  }): ProjectsConfigurations & NxJsonConfiguration {
    const nxJson = readNxJson(this.root);
    return { ...this.readProjectsConfigurations(opts), ...nxJson };
  }

  private mergeTargetDefaultsIntoProjectDescriptions(
    projects: Record<string, ProjectConfiguration>,
    nxJson: NxJsonConfiguration
  ) {
    for (const proj of Object.values(projects)) {
      if (proj.targets) {
        for (const targetName of Object.keys(proj.targets ?? {})) {
          const projectTargetDefinition = proj.targets[targetName];
          const defaults = readTargetDefaultsForTarget(
            targetName,
            nxJson.targetDefaults,
            projectTargetDefinition.executor
          );

          if (defaults) {
            proj.targets[targetName] = mergeTargetConfigurations(
              proj,
              targetName,
              defaults
            );
          }
        }
      }
    }
    return projects;
  }
}

/**
 * Pulled from toFileName in names from @nx/devkit.
 * Todo: Should refactor, not duplicate.
 */
export function toProjectName(fileName: string): string {
  const parts = dirname(fileName).split(/[\/\\]/g);
  return parts[parts.length - 1].toLowerCase();
}

/**
 * @deprecated Use getGlobPatternsFromPluginsAsync instead.
 */
export function getGlobPatternsFromPlugins(
  nxJson: NxJsonConfiguration,
  paths: string[],
  root = workspaceRoot
): string[] {
  const plugins = loadNxPluginsSync(nxJson?.plugins, paths, root);

  return plugins.flatMap((plugin) =>
    plugin.processProjectNodes ? Object.keys(plugin.processProjectNodes) : []
  );
}

export async function getGlobPatternsFromPluginsAsync(
  nxJson: NxJsonConfiguration,
  paths: string[],
  root = workspaceRoot
): Promise<string[]> {
  const plugins = await loadNxPlugins(nxJson?.plugins, paths, root);

  return plugins.flatMap((plugin) =>
    plugin.processProjectNodes ? Object.keys(plugin.processProjectNodes) : []
  );
}

function mergeProjectConfigurationIntoWorkspace(
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

export function buildProjectsConfigurationsFromProjectPaths(
  nxJson: NxJsonConfiguration,
  projectFiles: string[], // making this parameter allows devkit to pick up newly created projects
  root: string = workspaceRoot,
  readJson: <T extends Object>(string) => T = <T extends Object>(string) =>
    readJsonFile<T>(string), // making this an arg allows us to reuse in devkit
  _ignorePluginInference = false // When resolving a local plugin, we can't also load plugins. This would cause an infinite loop.
): {
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
} {
  const projectRootMap: Map<string, string> = new Map();
  const projects: Record<string, ProjectConfiguration> = {};
  const externalNodes: Record<string, ProjectGraphExternalNode> = {};
  // We go in reverse here s.t. plugins listed first in the plugins array have highest priority - they overwrite
  // whatever configuration was added by plugins later in the array.
  const plugins =
    _ignorePluginInference || !nxJson?.plugins?.length
      ? []
      : loadNxPluginsSync(nxJson.plugins).reverse();

  // We push the nx core node builder onto the end, s.t. it overwrites any user specified behavior

  const nxCorePlugin: NxPluginV2 = getProjectJsonPlugin(readJson);
  const nxPackageManagerWorkspacesPlugin: NxPluginV2 =
    getPackageJsonWorkspacesPlugin(root, nxJson, readJson);
  plugins.push(nxPackageManagerWorkspacesPlugin, nxCorePlugin);

  // We iterate over plugins first - this ensures that plugins specified first take precedence.
  for (const plugin of plugins) {
    // Within a plugin patterns specified later overwrite info from earlier matches.
    for (const pattern in plugin.processProjectNodes ?? {}) {
      for (const file of projectFiles) {
        if (minimatch(file, pattern)) {
          const { projectNodes, externalNodes: pluginExternalNodes } =
            plugin.processProjectNodes[pattern](file, {
              projectsConfigurations: projects,
              nxJsonConfiguration: nxJson,
              workspaceRoot: root,
            });
          for (const node in projectNodes) {
            mergeProjectConfigurationIntoWorkspace(
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

// we have to do it this way to preserve the order of properties
// not to screw up the formatting
export function renamePropertyWithStableKeys(
  obj: any,
  from: string,
  to: string
) {
  const copy = { ...obj };
  Object.keys(obj).forEach((k) => {
    delete obj[k];
  });
  Object.keys(copy).forEach((k) => {
    if (k === from) {
      obj[to] = copy[k];
    } else {
      obj[k] = copy[k];
    }
  });
}
