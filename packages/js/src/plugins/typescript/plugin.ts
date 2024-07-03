import {
  detectPackageManager,
  joinPathFragments,
  normalizePath,
  readJsonFile,
  writeJsonFile,
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  type NxJsonConfiguration,
  type TargetConfiguration,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { minimatch } from 'minimatch';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getLockFileName } from 'nx/src/plugins/js/lock-file/lock-file';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import type { ParsedCommandLine } from 'typescript';
import { readTsConfig } from '../../utils/typescript/ts-config';

export interface TscPluginOptions {
  typecheck?:
    | boolean
    | {
        targetName?: string;
      };
  build?:
    | boolean
    | {
        targetName?: string;
        configName?: string;
      };
}

interface NormalizedPluginOptions {
  typecheck:
    | false
    | {
        targetName: string;
      };
  build:
    | false
    | {
        targetName: string;
        configName: string;
      };
}

const cachePath = join(workspaceDataDirectory, 'tsc.hash');
const targetsCache = readTargetsCache();

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration<unknown>>
> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache() {
  const oldCache = readTargetsCache();
  writeJsonFile(cachePath, {
    ...oldCache,
    ...targetsCache,
  });
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache();
  return [];
};

export const PLUGIN_NAME = '@nx/js/typescript';

export const createNodes: CreateNodes<TscPluginOptions> = [
  '**/tsconfig*.json',
  async (configFilePath, options, context) => {
    const pluginOptions = normalizePluginOptions(options);
    const projectRoot = dirname(configFilePath);
    const fullConfigPath = joinPathFragments(
      context.workspaceRoot,
      configFilePath
    );

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    // Do not create a project if it's not a tsconfig.json and there is no tsconfig.json in the same directory
    if (
      basename(configFilePath) !== 'tsconfig.json' &&
      !siblingFiles.includes('tsconfig.json')
    ) {
      return {};
    }

    const nodeHash = await calculateHashForCreateNodes(
      projectRoot,
      pluginOptions,
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    );
    // The hash is calculated at the node/project level, so we add the config file path to avoid conflicts when caching
    const cacheKey = `${nodeHash}_${configFilePath}`;

    targetsCache[cacheKey] ??= buildTscTargets(
      fullConfigPath,
      projectRoot,
      pluginOptions,
      context
    );

    return {
      projects: {
        [projectRoot]: {
          projectType: 'library',
          targets: targetsCache[cacheKey],
        },
      },
    };
  },
];

function buildTscTargets(
  configFilePath: string,
  projectRoot: string,
  options: NormalizedPluginOptions,
  context: CreateNodesContext
) {
  const targets: Record<string, TargetConfiguration> = {};
  const namedInputs = getNamedInputs(projectRoot, context);
  const tsConfig = readCachedTsConfig(configFilePath);

  // TODO: check whether we want to always run with --pretty --verbose, it makes replacing scripts harder
  // `--verbose` conflicts with `tsc -b --clean`, might be another reason for not using it, it would
  // prevent users from running the task with `--clean` flag.
  // Should we consider creating a different optional target for `--clean`?
  // Should we consider having a plugin option to disable `--pretty` and `--verbose`?

  let internalProjectReferences: Record<string, ParsedCommandLine>;
  // Typecheck target
  if (basename(configFilePath) === 'tsconfig.json' && options.typecheck) {
    internalProjectReferences = resolveInternalProjectReferences(
      configFilePath,
      tsConfig
    );
    const targetName = options.typecheck.targetName;
    if (!targets[targetName]) {
      let command = `tsc --build --emitDeclarationOnly --pretty --verbose`;
      if (
        tsConfig.options.noEmit ||
        Object.values(internalProjectReferences).some(
          (ref) => ref.options.noEmit
        )
      ) {
        // `--emitDeclarationOnly` and `--noEmit` are mutually exclusive, so
        // we remove `--emitDeclarationOnly` if `--noEmit` is set.
        command = `tsc --build --pretty --verbose`;
      }

      targets[targetName] = {
        dependsOn: [`^${targetName}`],
        command,
        options: { cwd: projectRoot },
        cache: true,
        inputs: getInputs(
          namedInputs,
          configFilePath,
          tsConfig,
          internalProjectReferences,
          context.workspaceRoot,
          projectRoot
        ),
        outputs: getOutputs(
          configFilePath,
          tsConfig,
          internalProjectReferences,
          context.workspaceRoot,
          projectRoot
        ),
      };
    }
  }

  // Build target
  if (options.build && basename(configFilePath) === options.build.configName) {
    internalProjectReferences ??= resolveInternalProjectReferences(
      configFilePath,
      tsConfig
    );
    const targetName = options.build.targetName;

    targets[targetName] = {
      dependsOn: [`^${targetName}`],
      command: `tsc --build ${options.build.configName} --pretty --verbose`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(
        namedInputs,
        configFilePath,
        tsConfig,
        internalProjectReferences,
        context.workspaceRoot,
        projectRoot
      ),
      outputs: getOutputs(
        configFilePath,
        tsConfig,
        internalProjectReferences,
        context.workspaceRoot,
        projectRoot
      ),
    };
  }

  return targets;
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs'],
  configFilePath: string,
  tsConfig: ParsedCommandLine,
  internalProjectReferences: Record<string, ParsedCommandLine>,
  workspaceRoot: string,
  projectRoot: string
): TargetConfiguration['inputs'] {
  const configFiles = new Set<string>();
  const includePaths = new Set<string>();
  const excludePaths = new Set<string>();

  const extendedConfigFiles = getExtendedConfigFiles(configFilePath, tsConfig);
  extendedConfigFiles.forEach((configPath) => {
    configFiles.add(configPath);
  });

  const projectTsConfigFiles: [string, ParsedCommandLine][] = [
    [configFilePath, tsConfig],
    ...Object.entries(internalProjectReferences),
  ];
  projectTsConfigFiles.forEach(([configPath, config]) => {
    configFiles.add(configPath);
    (config.raw?.include ?? []).forEach((p: string) => includePaths.add(p));

    if (config.raw?.exclude) {
      /**
       * We need to filter out the exclude paths that are already included in
       * other tsconfig files. If they are not included in other tsconfig files,
       * they still correctly apply to the current file and we should keep them.
       */
      const otherFilesInclude: string[] = [];
      projectTsConfigFiles.forEach(([path, c]) => {
        if (path !== configPath) {
          otherFilesInclude.push(...(c.raw?.include ?? []));
        }
      });
      const normalize = (p: string) => (p.startsWith('./') ? p.slice(2) : p);
      config.raw.exclude.forEach((excludePath: string) => {
        if (
          !otherFilesInclude.some(
            (includePath) =>
              minimatch(normalize(includePath), normalize(excludePath)) ||
              minimatch(normalize(excludePath), normalize(includePath))
          )
        ) {
          excludePaths.add(excludePath);
        }
      });
    }
  });

  const inputs: TargetConfiguration['inputs'] = [];
  if (includePaths.size) {
    inputs.push(
      ...Array.from(configFiles).map((p: string) =>
        pathToInputOrOutput(p, workspaceRoot, projectRoot)
      ),
      ...Array.from(includePaths).map((p: string) =>
        pathToInputOrOutput(
          joinPathFragments(projectRoot, p),
          workspaceRoot,
          projectRoot
        )
      )
    );
  } else {
    // If we couldn't identify any include paths, we default to the default
    // named inputs.
    inputs.push('production' in namedInputs ? 'production' : 'default');
  }

  if (excludePaths.size) {
    inputs.push(
      ...Array.from(excludePaths).map(
        (p: string) =>
          `!${pathToInputOrOutput(
            joinPathFragments(projectRoot, p),
            workspaceRoot,
            projectRoot
          )}`
      )
    );
  }

  if (hasExternalProjectReferences(configFilePath, tsConfig)) {
    // Importing modules from a referenced project will load its output declaration files (d.ts)
    // https://www.typescriptlang.org/docs/handbook/project-references.html#what-is-a-project-reference
    inputs.push({ dependentTasksOutputFiles: '**/*.d.ts' });
  } else {
    inputs.push('production' in namedInputs ? '^production' : '^default');
  }

  inputs.push({ externalDependencies: ['typescript'] });

  return inputs;
}

function getOutputs(
  configFilePath: string,
  tsConfig: ParsedCommandLine,
  internalProjectReferences: Record<string, ParsedCommandLine>,
  workspaceRoot: string,
  projectRoot: string
): string[] {
  const outputs = new Set<string>();

  // We could have more surgical outputs based on the tsconfig options, but the
  // user could override them through the command line and that wouldn't be
  // reflected in the outputs. So, we just include everything that could be
  // produced by the tsc command.
  [tsConfig, ...Object.values(internalProjectReferences)].forEach((config) => {
    if (config.options.outFile) {
      const outFileName = basename(config.options.outFile, '.js');
      const outFileDir = dirname(config.options.outFile);
      outputs.add(
        joinPathFragments(
          '{workspaceRoot}',
          relative(workspaceRoot, config.options.outFile)
        )
      );
      // outFile is not be used with .cjs, .mjs, .jsx, so the list is simpler
      const outDir = relative(workspaceRoot, outFileDir);
      outputs.add(
        joinPathFragments('{workspaceRoot}', outDir, `${outFileName}.js.map`)
      );
      outputs.add(
        joinPathFragments('{workspaceRoot}', outDir, `${outFileName}.d.ts`)
      );
      outputs.add(
        joinPathFragments('{workspaceRoot}', outDir, `${outFileName}.d.ts.map`)
      );
      // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
      outputs.add(
        tsConfig.options.tsBuildInfoFile
          ? pathToInputOrOutput(
              tsConfig.options.tsBuildInfoFile,
              workspaceRoot,
              projectRoot
            )
          : joinPathFragments(
              '{workspaceRoot}',
              outDir,
              `${outFileName}.tsbuildinfo`
            )
      );
    } else if (config.options.outDir) {
      outputs.add(
        joinPathFragments(
          '{workspaceRoot}',
          relative(workspaceRoot, config.options.outDir)
        )
      );
    } else if (config.fileNames.length) {
      // tsc produce files in place when no outDir or outFile is set
      outputs.add(joinPathFragments('{projectRoot}', '**/*.js'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.cjs'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.mjs'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.jsx'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.js.map')); // should also include .cjs and .mjs data
      outputs.add(joinPathFragments('{projectRoot}', '**/*.jsx.map'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.d.ts'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.d.cts'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.d.mts'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.d.ts.map'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.d.cts.map'));
      outputs.add(joinPathFragments('{projectRoot}', '**/*.d.mts.map'));

      // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
      const name = basename(configFilePath, '.json');
      outputs.add(
        tsConfig.options.tsBuildInfoFile
          ? pathToInputOrOutput(
              tsConfig.options.tsBuildInfoFile,
              workspaceRoot,
              projectRoot
            )
          : joinPathFragments('{projectRoot}', `${name}.tsbuildinfo`)
      );
    }
  });

  return Array.from(outputs);
}

function pathToInputOrOutput(
  path: string,
  workspaceRoot: string,
  projectRoot: string
): string {
  const pathRelativeToProjectRoot = normalizePath(relative(projectRoot, path));
  if (pathRelativeToProjectRoot.startsWith('..')) {
    return joinPathFragments('{workspaceRoot}', relative(workspaceRoot, path));
  }

  return joinPathFragments('{projectRoot}', pathRelativeToProjectRoot);
}

function getExtendedConfigFiles(
  tsConfigPath: string,
  tsConfig: ParsedCommandLine
): string[] {
  const extendedConfigFiles = new Set<string>();

  let currentConfigPath = tsConfigPath;
  let currentConfig = tsConfig;
  while (currentConfig.raw?.extends) {
    const extendedConfigPath = join(
      dirname(currentConfigPath),
      currentConfig.raw.extends
    );
    extendedConfigFiles.add(extendedConfigPath);
    const extendedConfig = readCachedTsConfig(extendedConfigPath);
    currentConfigPath = extendedConfigPath;
    currentConfig = extendedConfig;
  }

  return Array.from(extendedConfigFiles);
}

function resolveInternalProjectReferences(
  configFilePath: string,
  tsConfig: ParsedCommandLine,
  projectReferences: Record<string, ParsedCommandLine> = {}
): Record<string, ParsedCommandLine> {
  if (!tsConfig.projectReferences?.length) {
    return projectReferences;
  }

  const basePath = getTsConfigBasePath(configFilePath);
  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (projectReferences[refConfigPath]) {
      // Already resolved
      continue;
    }

    if (isExternalProjectReference(refConfigPath, basePath)) {
      continue;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }
    const refTsConfig = readCachedTsConfig(refConfigPath);
    projectReferences[refConfigPath] = refTsConfig;

    resolveInternalProjectReferences(
      refConfigPath,
      refTsConfig,
      projectReferences
    );
  }

  return projectReferences;
}

function hasExternalProjectReferences(
  tsConfigPath: string,
  tsConfig: ParsedCommandLine,
  seen = new Set<string>()
): boolean {
  if (!tsConfig.projectReferences?.length) {
    return false;
  }
  seen.add(tsConfigPath);

  const basePath = getTsConfigBasePath(tsConfigPath);
  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (seen.has(refConfigPath)) {
      // Already seen
      continue;
    }

    if (isExternalProjectReference(refConfigPath, basePath)) {
      return true;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }
    const refTsConfig = readCachedTsConfig(refConfigPath);
    const result = hasExternalProjectReferences(refConfigPath, refTsConfig);

    if (result) {
      return true;
    }
  }

  return false;
}

function isExternalProjectReference(
  refTsConfigPath: string,
  basePath: string
): boolean {
  const refBasePath = getTsConfigBasePath(refTsConfigPath);

  // TODO: there could be internal project references in nested dirs (e.g.
  // our storybook generator generates a nested `.storybook/tsconfig.json`),
  // which would be considered an external project reference but it's not.
  // We could instead check if the referenced tsconfig is outside the project
  // root, but that would cause issues with standalone workspaces with nested
  // projects.
  return refBasePath !== basePath;
}

function getTsConfigBasePath(tsConfigPath: string): string {
  return statSync(tsConfigPath).isFile() ? dirname(tsConfigPath) : tsConfigPath;
}

// TODO: we could probably persist this to disk to avoid reading the same
// tsconfig files over multiple runs
const tsConfigCache = new Map<string, ParsedCommandLine>();

function readCachedTsConfig(tsConfigPath: string): ParsedCommandLine {
  const cacheKey = getTsConfigCacheKey(tsConfigPath);

  if (tsConfigCache.has(cacheKey)) {
    return tsConfigCache.get(cacheKey)!;
  }

  const tsConfig = readTsConfig(tsConfigPath);
  tsConfigCache.set(cacheKey, tsConfig);

  return tsConfig;
}

function getTsConfigCacheKey(tsConfigPath: string): string {
  const timestamp = statSync(tsConfigPath).mtimeMs;

  return `${tsConfigPath}-${timestamp}`;
}

function normalizePluginOptions(
  pluginOptions: TscPluginOptions = {}
): NormalizedPluginOptions {
  const defaultTypecheckTargetName = 'typecheck';
  let typecheck: NormalizedPluginOptions['typecheck'] = {
    targetName: defaultTypecheckTargetName,
  };
  if (pluginOptions.typecheck === false) {
    typecheck = false;
  } else if (
    pluginOptions.typecheck &&
    typeof pluginOptions.typecheck !== 'boolean'
  ) {
    typecheck = {
      targetName:
        pluginOptions.typecheck.targetName ?? defaultTypecheckTargetName,
    };
  }

  const defaultBuildTargetName = 'build';
  const defaultBuildConfigName = 'tsconfig.lib.json';
  let build: NormalizedPluginOptions['build'] = {
    targetName: defaultBuildTargetName,
    configName: defaultBuildConfigName,
  };
  // Build target is not enabled by default
  if (!pluginOptions.build) {
    build = false;
  } else if (pluginOptions.build && typeof pluginOptions.build !== 'boolean') {
    build = {
      targetName: pluginOptions.build.targetName ?? defaultBuildTargetName,
      configName: pluginOptions.build.configName ?? defaultBuildConfigName,
    };
  }

  return {
    typecheck,
    build,
  };
}
