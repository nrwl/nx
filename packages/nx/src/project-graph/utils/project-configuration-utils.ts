import { NxJsonConfiguration, TargetDefaults } from '../../config/nx-json';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import {
  ProjectConfiguration,
  ProjectMetadata,
  TargetConfiguration,
  TargetMetadata,
} from '../../config/workspace-json-project-json';
import { NX_PREFIX } from '../../utils/logger';
import { CreateNodesResult, LoadedNxPlugin } from '../../utils/nx-plugin';
import { readJsonFile } from '../../utils/fileutils';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  ONLY_MODIFIES_EXISTING_TARGET,
  OVERRIDE_SOURCE_FILE,
} from '../../plugins/target-defaults/target-defaults-plugin';

import { minimatch } from 'minimatch';
import { join } from 'path';
import { performance } from 'perf_hooks';

export type SourceInformation = [file: string, plugin: string];
export type ConfigurationSourceMaps = Record<
  string,
  Record<string, SourceInformation>
>;

export function mergeProjectConfigurationIntoRootMap(
  projectRootMap: Map<string, ProjectConfiguration>,
  project: ProjectConfiguration & {
    targets?: Record<
      string,
      TargetConfiguration & { [ONLY_MODIFIES_EXISTING_TARGET]?: boolean }
    >;
  },
  configurationSourceMaps?: ConfigurationSourceMaps,
  sourceInformation?: SourceInformation,
  // This function is used when reading project configuration
  // in generators, where we don't want to do this.
  skipCommandNormalization?: boolean
): void {
  if (configurationSourceMaps && !configurationSourceMaps[project.root]) {
    configurationSourceMaps[project.root] = {};
  }
  const sourceMap = configurationSourceMaps?.[project.root];

  let matchingProject = projectRootMap.get(project.root);

  if (!matchingProject) {
    projectRootMap.set(project.root, {
      root: project.root,
    });
    matchingProject = projectRootMap.get(project.root);
    if (sourceMap) {
      sourceMap[`root`] = sourceInformation;
    }
  }

  // This handles top level properties that are overwritten.
  // e.g. `srcRoot`, `projectType`, or other fields that shouldn't be extended
  // Note: `name` is set specifically here to keep it from changing. The name is
  // always determined by the first inference plugin to ID a project, unless it has
  // a project.json in which case it was already updated above.
  const updatedProjectConfiguration = {
    ...matchingProject,
  };

  for (const k in project) {
    if (
      ![
        'tags',
        'implicitDependencies',
        'generators',
        'targets',
        'metadata',
        'namedInputs',
      ].includes(k)
    ) {
      updatedProjectConfiguration[k] = project[k];
      if (sourceMap) {
        sourceMap[`${k}`] = sourceInformation;
      }
    }
  }

  // The next blocks handle properties that should be themselves merged (e.g. targets, tags, and implicit dependencies)
  if (project.tags) {
    updatedProjectConfiguration.tags = Array.from(
      new Set((matchingProject.tags ?? []).concat(project.tags))
    );

    if (sourceMap) {
      sourceMap['tags'] ??= sourceInformation;
      project.tags.forEach((tag) => {
        sourceMap[`tags.${tag}`] = sourceInformation;
      });
    }
  }

  if (project.implicitDependencies) {
    updatedProjectConfiguration.implicitDependencies = (
      matchingProject.implicitDependencies ?? []
    ).concat(project.implicitDependencies);

    if (sourceMap) {
      sourceMap['implicitDependencies'] ??= sourceInformation;
      project.implicitDependencies.forEach((implicitDependency) => {
        sourceMap[`implicitDependencies.${implicitDependency}`] =
          sourceInformation;
      });
    }
  }

  if (project.generators) {
    // Start with generators config in new project.
    updatedProjectConfiguration.generators = { ...project.generators };

    if (sourceMap) {
      sourceMap['generators'] ??= sourceInformation;
      for (const generator in project.generators) {
        sourceMap[`generators.${generator}`] = sourceInformation;
        for (const property in project.generators[generator]) {
          sourceMap[`generators.${generator}.${property}`] = sourceInformation;
        }
      }
    }

    if (matchingProject.generators) {
      // For each generator that was already defined, shallow merge the options.
      // Project contains the new info, so it has higher priority.
      for (const generator in matchingProject.generators) {
        updatedProjectConfiguration.generators[generator] = {
          ...matchingProject.generators[generator],
          ...project.generators[generator],
        };
      }
    }
  }

  if (project.namedInputs) {
    updatedProjectConfiguration.namedInputs = {
      ...matchingProject.namedInputs,
      ...project.namedInputs,
    };

    if (sourceMap) {
      sourceMap['namedInputs'] ??= sourceInformation;
      for (const namedInput in project.namedInputs) {
        sourceMap[`namedInputs.${namedInput}`] = sourceInformation;
      }
    }
  }

  if (project.metadata) {
    updatedProjectConfiguration.metadata = mergeMetadata(
      sourceMap,
      sourceInformation,
      'metadata',
      project.metadata,
      matchingProject.metadata
    );
  }

  if (project.targets) {
    // We merge the targets with special handling, so clear this back to the
    // targets as defined originally before merging.
    updatedProjectConfiguration.targets = matchingProject?.targets ?? {};
    if (sourceMap) {
      sourceMap['targets'] ??= sourceInformation;
    }

    // For each target defined in the new config
    for (const targetName in project.targets) {
      // Always set source map info for the target, but don't overwrite info already there
      // if augmenting an existing target.

      const target = project.targets?.[targetName];

      if (sourceMap && !target?.[ONLY_MODIFIES_EXISTING_TARGET]) {
        sourceMap[`targets.${targetName}`] = sourceInformation;
      }

      // If ONLY_MODIFIES_EXISTING_TARGET is true, and its not on the matching project
      // we shouldn't merge its info into the graph
      if (
        target?.[ONLY_MODIFIES_EXISTING_TARGET] &&
        !matchingProject.targets?.[targetName]
      ) {
        continue;
      }

      const mergedTarget = mergeTargetConfigurations(
        skipCommandNormalization
          ? target
          : resolveCommandSyntacticSugar(target, project.root),
        matchingProject.targets?.[targetName],
        sourceMap,
        sourceInformation,
        `targets.${targetName}`
      );

      // We don't want the symbol to live on past the merge process
      if (mergedTarget?.[ONLY_MODIFIES_EXISTING_TARGET])
        delete mergedTarget?.[ONLY_MODIFIES_EXISTING_TARGET];

      updatedProjectConfiguration.targets[targetName] = mergedTarget;
    }
  }

  projectRootMap.set(
    updatedProjectConfiguration.root,
    updatedProjectConfiguration
  );
}

function mergeMetadata<T = ProjectMetadata | TargetMetadata>(
  sourceMap: Record<string, [file: string, plugin: string]>,
  sourceInformation: [file: string, plugin: string],
  baseSourceMapPath: string,
  metadata: T,
  matchingMetadata?: T
): T {
  const result: T = {
    ...(matchingMetadata ?? ({} as T)),
  };
  for (const [metadataKey, value] of Object.entries(metadata)) {
    const existingValue = matchingMetadata?.[metadataKey];

    if (Array.isArray(value) && Array.isArray(existingValue)) {
      for (const item of [...value]) {
        const newLength = result[metadataKey].push(item);
        if (sourceMap) {
          sourceMap[`${baseSourceMapPath}.${metadataKey}.${newLength - 1}`] =
            sourceInformation;
        }
      }
    } else if (Array.isArray(value) && existingValue === undefined) {
      result[metadataKey] ??= value;
      if (sourceMap) {
        sourceMap[`${baseSourceMapPath}.${metadataKey}`] = sourceInformation;
      }
      for (let i = 0; i < value.length; i++) {
        if (sourceMap) {
          sourceMap[`${baseSourceMapPath}.${metadataKey}.${i}`] =
            sourceInformation;
        }
      }
    } else if (typeof value === 'object' && typeof existingValue === 'object') {
      for (const key in value) {
        const existingValue = matchingMetadata?.[metadataKey]?.[key];

        if (Array.isArray(value[key]) && Array.isArray(existingValue)) {
          for (const item of value[key]) {
            const i = result[metadataKey][key].push(item);
            if (sourceMap) {
              sourceMap[`${baseSourceMapPath}.${metadataKey}.${key}.${i - 1}`] =
                sourceInformation;
            }
          }
        } else {
          result[metadataKey] = value;
          if (sourceMap) {
            sourceMap[`${baseSourceMapPath}.${metadataKey}`] =
              sourceInformation;
          }
        }
      }
    } else {
      result[metadataKey] = value;
      if (sourceMap) {
        sourceMap[`${baseSourceMapPath}.${metadataKey}`] = sourceInformation;

        if (typeof value === 'object') {
          for (const k in value) {
            sourceMap[`${baseSourceMapPath}.${metadataKey}.${k}`] =
              sourceInformation;
            if (Array.isArray(value[k])) {
              for (let i = 0; i < value[k].length; i++) {
                sourceMap[`${baseSourceMapPath}.${metadataKey}.${k}.${i}`] =
                  sourceInformation;
              }
            }
          }
        }
      }
    }
  }
  return result;
}

export type ConfigurationResult = {
  projects: Record<string, ProjectConfiguration>;
  externalNodes: Record<string, ProjectGraphExternalNode>;
  projectRootMap: Record<string, string>;
  sourceMaps: ConfigurationSourceMaps;
};
type CreateNodesResultWithContext = CreateNodesResult & {
  file: string;
  pluginName: string;
};

/**
 * Transforms a list of project paths into a map of project configurations.
 *
 * @param root The workspace root
 * @param nxJson The NxJson configuration
 * @param workspaceFiles A list of non-ignored workspace files
 * @param plugins The plugins that should be used to infer project configuration
 */
export function createProjectConfigurations(
  root: string = workspaceRoot,
  nxJson: NxJsonConfiguration,
  workspaceFiles: string[], // making this parameter allows devkit to pick up newly created projects
  plugins: LoadedNxPlugin[]
): Promise<ConfigurationResult> {
  performance.mark('build-project-configs:start');

  const results: Array<Promise<Array<CreateNodesResultWithContext>>> = [];
  const errors: Array<CreateNodesError | MergeNodesError> = [];

  // We iterate over plugins first - this ensures that plugins specified first take precedence.
  for (const { plugin, options, include, exclude } of plugins) {
    const [pattern, createNodes] = plugin.createNodes ?? [];
    const pluginResults: Array<
      CreateNodesResultWithContext | Promise<CreateNodesResultWithContext>
    > = [];

    performance.mark(`${plugin.name}:createNodes - start`);
    if (!pattern) {
      continue;
    }

    const matchingConfigFiles: string[] = [];

    for (const file of workspaceFiles) {
      if (minimatch(file, pattern, { dot: true })) {
        if (include) {
          const included = include.some((includedPattern) =>
            minimatch(file, includedPattern, { dot: true })
          );
          if (!included) {
            continue;
          }
        }

        if (exclude) {
          const excluded = include.some((excludedPattern) =>
            minimatch(file, excludedPattern, { dot: true })
          );
          if (excluded) {
            continue;
          }
        }

        matchingConfigFiles.push(file);
      }
    }
    for (const file of matchingConfigFiles) {
      performance.mark(`${plugin.name}:createNodes:${file} - start`);
      try {
        let r = createNodes(file, options, {
          nxJsonConfiguration: nxJson,
          workspaceRoot: root,
          configFiles: matchingConfigFiles,
        });

        if (r instanceof Promise) {
          pluginResults.push(
            r
              .catch((error) => {
                performance.mark(`${plugin.name}:createNodes:${file} - end`);
                errors.push(
                  new CreateNodesError({
                    file,
                    pluginName: plugin.name,
                    error,
                  })
                );
                return {
                  projects: {},
                };
              })
              .then((r) => {
                performance.mark(`${plugin.name}:createNodes:${file} - end`);
                performance.measure(
                  `${plugin.name}:createNodes:${file}`,
                  `${plugin.name}:createNodes:${file} - start`,
                  `${plugin.name}:createNodes:${file} - end`
                );
                return { ...r, file, pluginName: plugin.name };
              })
          );
        } else {
          performance.mark(`${plugin.name}:createNodes:${file} - end`);
          performance.measure(
            `${plugin.name}:createNodes:${file}`,
            `${plugin.name}:createNodes:${file} - start`,
            `${plugin.name}:createNodes:${file} - end`
          );
          pluginResults.push({
            ...r,
            file,
            pluginName: plugin.name,
          });
        }
      } catch (error) {
        errors.push(
          new CreateNodesError({
            file,
            pluginName: plugin.name,
            error,
          })
        );
      }
    }

    results.push(
      Promise.all(pluginResults).then((results) => {
        performance.mark(`${plugin.name}:createNodes - end`);
        performance.measure(
          `${plugin.name}:createNodes`,
          `${plugin.name}:createNodes - start`,
          `${plugin.name}:createNodes - end`
        );
        return results;
      })
    );
  }

  return Promise.all(results).then((results) => {
    performance.mark('createNodes:merge - start');
    const projectRootMap: Map<string, ProjectConfiguration> = new Map();
    const externalNodes: Record<string, ProjectGraphExternalNode> = {};
    const configurationSourceMaps: Record<
      string,
      Record<string, SourceInformation>
    > = {};

    for (const result of results.flat()) {
      const {
        projects: projectNodes,
        externalNodes: pluginExternalNodes,
        file,
        pluginName,
      } = result;

      const sourceInfo: SourceInformation = [file, pluginName];

      if (result[OVERRIDE_SOURCE_FILE]) {
        sourceInfo[0] = result[OVERRIDE_SOURCE_FILE];
      }

      for (const node in projectNodes) {
        const project = {
          root: node,
          ...projectNodes[node],
        };
        try {
          mergeProjectConfigurationIntoRootMap(
            projectRootMap,
            project,
            configurationSourceMaps,
            sourceInfo
          );
        } catch (error) {
          errors.push(
            new MergeNodesError({
              file,
              pluginName,
              error,
            })
          );
        }
      }
      Object.assign(externalNodes, pluginExternalNodes);
    }

    const projects = readProjectConfigurationsFromRootMap(projectRootMap);
    const rootMap = createRootMap(projectRootMap);

    performance.mark('createNodes:merge - end');
    performance.measure(
      'createNodes:merge',
      'createNodes:merge - start',
      'createNodes:merge - end'
    );

    performance.mark('build-project-configs:end');
    performance.measure(
      'build-project-configs',
      'build-project-configs:start',
      'build-project-configs:end'
    );

    if (errors.length === 0) {
      return {
        projects,
        externalNodes,
        projectRootMap: rootMap,
        sourceMaps: configurationSourceMaps,
      };
    } else {
      throw new ProjectConfigurationsError(errors, {
        projects,
        externalNodes,
        projectRootMap: rootMap,
        sourceMaps: configurationSourceMaps,
      });
    }
  });
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
    // We're setting `// targets` as a comment `targets` is empty due to Project Crystal.
    // Strip it before returning configuration for usage.
    if (configuration['// targets']) delete configuration['// targets'];
    if (!configuration.name) {
      try {
        const { name } = readJsonFile(join(root, 'package.json'));
        configuration.name = name;
      } catch {
        throw new Error(`Project at ${root} has no name provided.`);
      }
    }
    if (configuration.name in projects) {
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

export class ProjectConfigurationsError extends Error {
  constructor(
    public readonly errors: Array<MergeNodesError | CreateNodesError>,
    public readonly partialProjectConfigurationsResult: ConfigurationResult
  ) {
    super('Failed to create project configurations');
    this.name = this.constructor.name;
  }
}

export class CreateNodesError extends Error {
  file: string;
  pluginName: string;

  constructor({
    file,
    pluginName,
    error,
  }: {
    file: string;
    pluginName: string;
    error: Error;
  }) {
    const msg = `The "${pluginName}" plugin threw an error while creating nodes from ${file}:`;

    super(msg, { cause: error });
    this.name = this.constructor.name;
    this.file = file;
    this.pluginName = pluginName;
    this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
  }
}

export class MergeNodesError extends Error {
  file: string;
  pluginName: string;

  constructor({
    file,
    pluginName,
    error,
  }: {
    file: string;
    pluginName: string;
    error: Error;
  }) {
    const msg = `The nodes created from ${file} by the "${pluginName}" could not be merged into the project graph:`;

    super(msg, { cause: error });
    this.name = this.constructor.name;
    this.file = file;
    this.pluginName = pluginName;
    this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
  }
}

/**
 * Merges two targets.
 *
 * Most properties from `target` will overwrite any properties from `baseTarget`.
 * Options and configurations are treated differently - they are merged together if the executor definition is compatible.
 *
 * @param target The target definition with higher priority
 * @param baseTarget The target definition that should be overwritten. Can be undefined, in which case the target is returned as-is.
 * @param projectConfigSourceMap The source map to be filled with metadata about where each property came from
 * @param sourceInformation The metadata about where the new target was defined
 * @param targetIdentifier The identifier for the target to merge, used for source map
 * @returns A merged target configuration
 */
export function mergeTargetConfigurations(
  target: TargetConfiguration,
  baseTarget?: TargetConfiguration,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string
): TargetConfiguration {
  const {
    configurations: defaultConfigurations,
    options: defaultOptions,
    ...baseTargetProperties
  } = baseTarget ?? {};

  // Target is "compatible", e.g. executor is defined only once or is the same
  // in both places. This means that it is likely safe to merge
  const isCompatible = isCompatibleTarget(baseTargetProperties, target);

  // If the targets are not compatible, we would normally overwrite the old target
  // with the new one. However, we have a special case for targets that have the
  // ONLY_MODIFIES_EXISTING_TARGET symbol set. This prevents the merged target
  // equaling info that should have only been used to modify the existing target.
  if (!isCompatible && target[ONLY_MODIFIES_EXISTING_TARGET]) {
    return baseTarget;
  }

  if (!isCompatible && projectConfigSourceMap) {
    // if the target is not compatible, we will simply override the options
    // we have to delete old entries from the source map
    for (const key in projectConfigSourceMap) {
      if (key.startsWith(`${targetIdentifier}`)) {
        delete projectConfigSourceMap[key];
      }
    }
  }

  // merge top level properties if they're compatible
  const result = {
    ...(isCompatible ? baseTargetProperties : {}),
    ...target,
  };

  // record top level properties in source map
  if (projectConfigSourceMap) {
    projectConfigSourceMap[targetIdentifier] = sourceInformation;

    // record root level target properties to source map
    for (const targetProperty in target) {
      const targetPropertyId = `${targetIdentifier}.${targetProperty}`;
      projectConfigSourceMap[targetPropertyId] = sourceInformation;
    }
  }

  // merge options if there are any
  // if the targets aren't compatible, we simply discard the old options during the merge
  if (target.options || defaultOptions) {
    result.options = mergeOptions(
      target.options,
      isCompatible ? defaultOptions : undefined,
      projectConfigSourceMap,
      sourceInformation,
      targetIdentifier
    );
  }

  // merge configurations if there are any
  // if the targets aren't compatible, we simply discard the old configurations during the merge
  if (target.configurations || defaultConfigurations) {
    result.configurations = mergeConfigurations(
      target.configurations,
      isCompatible ? defaultConfigurations : undefined,
      projectConfigSourceMap,
      sourceInformation,
      targetIdentifier
    );
  }

  if (target.metadata) {
    result.metadata = mergeMetadata(
      projectConfigSourceMap,
      sourceInformation,
      `${targetIdentifier}.metadata`,
      target.metadata,
      baseTarget?.metadata
    );
  }

  return result as TargetConfiguration;
}

/**
 * Checks if targets options are compatible - used when merging configurations
 * to avoid merging options for @nx/js:tsc into something like @nx/webpack:webpack.
 *
 * If the executors are both specified and don't match, the options aren't considered
 * "compatible" and shouldn't be merged.
 */
export function isCompatibleTarget(
  a: TargetConfiguration,
  b: TargetConfiguration
) {
  const oneHasNoExecutor = !a.executor || !b.executor;
  const bothHaveSameExecutor = a.executor === b.executor;

  if (oneHasNoExecutor) return true;
  if (!bothHaveSameExecutor) return false;

  const isRunCommands = a.executor === 'nx:run-commands';
  if (isRunCommands) {
    const aCommand = a.options?.command ?? a.options?.commands.join(' && ');
    const bCommand = b.options?.command ?? b.options?.commands.join(' && ');

    const oneHasNoCommand = !aCommand || !bCommand;
    const hasSameCommand = aCommand === bCommand;

    return oneHasNoCommand || hasSameCommand;
  }

  const isRunScript = a.executor === 'nx:run-script';
  if (isRunScript) {
    const aScript = a.options?.script;
    const bScript = b.options?.script;

    const oneHasNoScript = !aScript || !bScript;
    const hasSameScript = aScript === bScript;

    return oneHasNoScript || hasSameScript;
  }

  return true;
}

function mergeConfigurations<T extends Object>(
  newConfigurations: Record<string, T> | undefined,
  baseConfigurations: Record<string, T> | undefined,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string
): Record<string, T> | undefined {
  const mergedConfigurations = {};

  const configurations = new Set([
    ...Object.keys(baseConfigurations ?? {}),
    ...Object.keys(newConfigurations ?? {}),
  ]);
  for (const configuration of configurations) {
    mergedConfigurations[configuration] = {
      ...(baseConfigurations?.[configuration] ?? {}),
      ...(newConfigurations?.[configuration] ?? {}),
    };
  }

  // record new configurations & configuration properties in source map
  if (projectConfigSourceMap) {
    for (const newConfiguration in newConfigurations) {
      projectConfigSourceMap[
        `${targetIdentifier}.configurations.${newConfiguration}`
      ] = sourceInformation;
      for (const configurationProperty in newConfigurations[newConfiguration]) {
        projectConfigSourceMap[
          `${targetIdentifier}.configurations.${newConfiguration}.${configurationProperty}`
        ] = sourceInformation;
      }
    }
  }

  return mergedConfigurations;
}

function mergeOptions(
  newOptions: Record<string, any> | undefined,
  baseOptions: Record<string, any> | undefined,
  projectConfigSourceMap?: Record<string, SourceInformation>,
  sourceInformation?: SourceInformation,
  targetIdentifier?: string
): Record<string, any> | undefined {
  const mergedOptions = {
    ...(baseOptions ?? {}),
    ...(newOptions ?? {}),
  };

  // record new options & option properties in source map
  if (projectConfigSourceMap) {
    for (const newOption in newOptions) {
      projectConfigSourceMap[`${targetIdentifier}.options.${newOption}`] =
        sourceInformation;
    }
  }

  return mergedOptions;
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

function createRootMap(projectRootMap: Map<string, ProjectConfiguration>) {
  const map: Record<string, string> = {};
  for (const [projectRoot, { name: projectName }] of projectRootMap) {
    map[projectRoot] = projectName;
  }
  return map;
}

function resolveCommandSyntacticSugar(
  target: TargetConfiguration,
  key: string
): TargetConfiguration {
  const { command, ...config } = target ?? {};

  if (!command) {
    return target;
  }

  if (config.executor) {
    throw new Error(
      `${NX_PREFIX} Project at ${key} should not have executor and command both configured.`
    );
  } else {
    return {
      ...config,
      executor: 'nx:run-commands',
      options: {
        ...config.options,
        command: command,
      },
    };
  }
}
