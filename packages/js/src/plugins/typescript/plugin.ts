import {
  createNodesFromFiles,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  normalizePath,
  readJsonFile,
  writeJsonFile,
  type CreateDependencies,
  type CreateNodes,
  type CreateNodesContext,
  type CreateNodesContextV2,
  type CreateNodesV2,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import {
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';
import * as posix from 'node:path/posix';
import { hashArray, hashFile, hashObject } from 'nx/src/hasher/file-hasher';
import picomatch = require('picomatch');
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getLockFileName } from 'nx/src/plugins/js/lock-file/lock-file';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import type { Extension, ParsedCommandLine, System } from 'typescript';
import {
  addBuildAndWatchDepsTargets,
  isValidPackageJsonBuildConfig,
  type ExtendedConfigFile,
  type ParsedTsconfigData,
} from './util';

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
        buildDepsName?: string;
        watchDepsName?: string;
      };
  verboseOutput?: boolean;
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
        buildDepsName?: string;
        watchDepsName?: string;
      };
  verboseOutput: boolean;
}

type TscProjectResult = Pick<ProjectConfiguration, 'targets'>;

type TsconfigCacheData = {
  data: ParsedTsconfigData;
  hash: string;
  extendedFilesHash: string;
};
type TsconfigCache = {
  version: number;
  data: Record<string, TsconfigCacheData>;
};

let ts: typeof import('typescript');
const pmc = getPackageManagerCommand();

const TSCONFIG_CACHE_VERSION = 1;
const TS_CONFIG_CACHE_PATH = join(
  workspaceDataDirectory,
  'tsconfig-files.hash'
);
let tsConfigCacheData: Record<string, TsconfigCacheData>;
let cache: {
  fileHashes: Record<string, string>;
  rawFiles: Record<string, string>;
  isExternalProjectReference: Record<string, boolean>;
};

function readFromCache<T extends object>(cachePath: string): T {
  try {
    return process.env.NX_CACHE_PROJECT_GRAPH !== 'false'
      ? readJsonFile<T>(cachePath)
      : ({} as T);
  } catch {
    return {} as T;
  }
}
function readTsConfigCacheData(): Record<string, TsconfigCacheData> {
  const cache = readFromCache<TsconfigCache>(TS_CONFIG_CACHE_PATH);

  if (cache.version !== TSCONFIG_CACHE_VERSION) {
    return {};
  }

  return cache.data;
}

function writeToCache<T extends object>(cachePath: string, data: T) {
  writeJsonFile(cachePath, data, { spaces: 0 });
}
function writeTsConfigCache(data: Record<string, TsconfigCacheData>) {
  writeToCache(TS_CONFIG_CACHE_PATH, {
    version: TSCONFIG_CACHE_VERSION,
    data,
  });
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

export const PLUGIN_NAME = '@nx/js/typescript';

const tsConfigGlob = '**/tsconfig*.json';

export const createNodesV2: CreateNodesV2<TscPluginOptions> = [
  tsConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const targetsCachePath = join(
      workspaceDataDirectory,
      `tsc-${optionsHash}.hash`
    );
    const targetsCache =
      readFromCache<Record<string, TscProjectResult>>(targetsCachePath);
    cache = { fileHashes: {}, rawFiles: {}, isExternalProjectReference: {} };
    initializeTsConfigCache(configFilePaths, context.workspaceRoot);

    const normalizedOptions = normalizePluginOptions(options);

    const {
      configFilePaths: validConfigFilePaths,
      hashes,
      projectRoots,
    } = await resolveValidConfigFilesAndHashes(
      configFilePaths,
      optionsHash,
      context
    );

    try {
      return await createNodesFromFiles(
        (configFilePath, options, context, idx) => {
          const projectRoot = projectRoots[idx];
          const hash = hashes[idx];
          const cacheKey = `${hash}_${configFilePath}`;

          targetsCache[cacheKey] ??= buildTscTargets(
            join(context.workspaceRoot, configFilePath),
            projectRoot,
            options,
            context
          );

          const { targets } = targetsCache[cacheKey];

          return {
            projects: {
              [projectRoot]: {
                projectType: 'library',
                targets,
              },
            },
          };
        },
        validConfigFilePaths,
        normalizedOptions,
        context
      );
    } finally {
      writeToCache(targetsCachePath, targetsCache);
      writeTsConfigCache(
        toRelativePaths(tsConfigCacheData, context.workspaceRoot)
      );
    }
  },
];

export const createNodes: CreateNodes<TscPluginOptions> = [
  tsConfigGlob,
  async (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );

    const projectRoot = dirname(configFilePath);
    if (
      !checkIfConfigFileShouldBeProject(configFilePath, projectRoot, context)
    ) {
      return {};
    }

    const normalizedOptions = normalizePluginOptions(options);
    cache = { fileHashes: {}, rawFiles: {}, isExternalProjectReference: {} };
    initializeTsConfigCache([configFilePath], context.workspaceRoot);

    const { targets } = buildTscTargets(
      join(context.workspaceRoot, configFilePath),
      projectRoot,
      normalizedOptions,
      context
    );

    writeTsConfigCache(
      toRelativePaths(tsConfigCacheData, context.workspaceRoot)
    );

    return {
      projects: {
        [projectRoot]: {
          projectType: 'library',
          targets,
        },
      },
    };
  },
];

async function resolveValidConfigFilesAndHashes(
  configFilePaths: readonly string[],
  optionsHash: string,
  context: CreateNodesContext | CreateNodesContextV2
): Promise<{
  configFilePaths: string[];
  hashes: string[];
  projectRoots: string[];
}> {
  const lockFileHash =
    hashFile(
      join(
        context.workspaceRoot,
        getLockFileName(detectPackageManager(context.workspaceRoot))
      )
    ) ?? '';

  const validConfigFilePaths: string[] = [];
  const hashes: string[] = [];
  const projectRoots: string[] = [];

  for await (const configFilePath of configFilePaths) {
    const projectRoot = dirname(configFilePath);
    if (
      !checkIfConfigFileShouldBeProject(configFilePath, projectRoot, context)
    ) {
      continue;
    }

    projectRoots.push(projectRoot);
    validConfigFilePaths.push(configFilePath);
    hashes.push(
      await getConfigFileHash(
        configFilePath,
        context.workspaceRoot,
        projectRoot,
        optionsHash,
        lockFileHash
      )
    );
  }

  return { configFilePaths: validConfigFilePaths, hashes, projectRoots };
}

/**
 * The cache key is composed by:
 * - hashes of the content of the relevant files that can affect what's inferred by the plugin:
 *   - current config file
 *   - config files extended by the current config file (recursively up to the root config file)
 *   - referenced config files that are internal to the owning Nx project of the current config file,
 *     or is a shallow external reference of the owning Nx project
 *   - lock file
 *   - project's package.json
 * - hash of the plugin options
 * - current config file path
 */
async function getConfigFileHash(
  configFilePath: string,
  workspaceRoot: string,
  projectRoot: string,
  optionsHash: string,
  lockFileHash: string
): Promise<string> {
  const fullConfigPath = join(workspaceRoot, configFilePath);

  const tsConfig = retrieveTsConfigFromCache(fullConfigPath, workspaceRoot);
  const extendedConfigFiles = getExtendedConfigFiles(tsConfig, workspaceRoot);
  const internalReferencedFiles = resolveInternalProjectReferences(
    tsConfig,
    workspaceRoot,
    projectRoot
  );
  const externalProjectReferences = resolveShallowExternalProjectReferences(
    tsConfig,
    workspaceRoot,
    projectRoot
  );

  let packageJson = null;
  try {
    packageJson = readJsonFile(
      join(workspaceRoot, projectRoot, 'package.json')
    );
  } catch {}

  return hashArray([
    ...[
      fullConfigPath,
      ...extendedConfigFiles.files.sort(),
      ...Object.keys(internalReferencedFiles).sort(),
      ...Object.keys(externalProjectReferences).sort(),
    ].map((file) => getFileHash(file, workspaceRoot)),
    ...extendedConfigFiles.packages.sort(),
    lockFileHash,
    optionsHash,
    ...(packageJson ? [hashObject(packageJson)] : []),
    // change this to bust the cache when making changes that would yield
    // different results for the same hash
    hashObject({ bust: 2 }),
  ]);
}

function checkIfConfigFileShouldBeProject(
  configFilePath: string,
  projectRoot: string,
  context: CreateNodesContext | CreateNodesContextV2
): boolean {
  // Do not create a project for the workspace root tsconfig files.
  if (projectRoot === '.') {
    return false;
  }

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return false;
  }

  // Do not create a project if it's not a tsconfig.json and there is no tsconfig.json in the same directory
  if (
    basename(configFilePath) !== 'tsconfig.json' &&
    !siblingFiles.includes('tsconfig.json')
  ) {
    return false;
  }

  // Do not create project for Next.js projects since they are not compatible with
  // project references and typecheck will fail.
  if (
    siblingFiles.includes('next.config.js') ||
    siblingFiles.includes('next.config.cjs') ||
    siblingFiles.includes('next.config.mjs') ||
    siblingFiles.includes('next.config.ts')
  ) {
    return false;
  }

  return true;
}

function buildTscTargets(
  configFilePath: string,
  projectRoot: string,
  options: NormalizedPluginOptions,
  context: CreateNodesContext
) {
  const targets: Record<string, TargetConfiguration> = {};
  const namedInputs = getNamedInputs(projectRoot, context);
  const tsConfig = retrieveTsConfigFromCache(
    configFilePath,
    context.workspaceRoot
  );

  let internalProjectReferences: Record<string, ParsedTsconfigData>;
  // Typecheck target
  if (
    basename(configFilePath) === 'tsconfig.json' &&
    options.typecheck &&
    tsConfig.raw?.['nx']?.addTypecheckTarget !== false
  ) {
    internalProjectReferences = resolveInternalProjectReferences(
      tsConfig,
      context.workspaceRoot,
      projectRoot
    );
    const externalProjectReferences = resolveShallowExternalProjectReferences(
      tsConfig,
      context.workspaceRoot,
      projectRoot
    );
    const targetName = options.typecheck.targetName;
    if (!targets[targetName]) {
      let command = `tsc --build --emitDeclarationOnly${
        options.verboseOutput ? ' --verbose' : ''
      }`;
      if (
        tsConfig.options.noEmit ||
        Object.values(internalProjectReferences).some(
          (ref) => ref.options.noEmit
        ) ||
        Object.values(externalProjectReferences).some(
          (ref) => ref.options.noEmit
        )
      ) {
        // `tsc --build` does not work with `noEmit: true`
        command = `echo "The 'typecheck' target is disabled because one or more project references set 'noEmit: true' in their tsconfig. Remove this property to resolve this issue."`;
      }

      const dependsOn: string[] = [`^${targetName}`];
      if (options.build && targets[options.build.targetName]) {
        // we already processed and have a build target
        dependsOn.unshift(options.build.targetName);
      } else if (options.build) {
        // check if the project will have a build target
        const buildConfigPath = joinPathFragments(
          projectRoot,
          options.build.configName
        );
        if (
          context.configFiles.some((f) => f === buildConfigPath) &&
          isValidPackageJsonBuildConfig(
            retrieveTsConfigFromCache(buildConfigPath, context.workspaceRoot),
            context.workspaceRoot,
            projectRoot
          )
        ) {
          dependsOn.unshift(options.build.targetName);
        }
      }

      targets[targetName] = {
        dependsOn,
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
          projectRoot,
          /* emitDeclarationOnly */ true
        ),
        syncGenerators: ['@nx/js:typescript-sync'],
        metadata: {
          technologies: ['typescript'],
          description: 'Runs type-checking for the project.',
          help: {
            command: `${pmc.exec} tsc --build --help`,
            example: {
              args: ['--force'],
            },
          },
        },
      };
    }
  }

  // Build target
  if (
    options.build &&
    basename(configFilePath) === options.build.configName &&
    isValidPackageJsonBuildConfig(tsConfig, context.workspaceRoot, projectRoot)
  ) {
    internalProjectReferences ??= resolveInternalProjectReferences(
      tsConfig,
      context.workspaceRoot,
      projectRoot
    );
    const targetName = options.build.targetName;

    targets[targetName] = {
      dependsOn: [`^${targetName}`],
      command: `tsc --build ${options.build.configName}${
        options.verboseOutput ? ' --verbose' : ''
      }`,
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
        projectRoot,
        // should be false for build target, but providing it just in case is set to true
        tsConfig.options.emitDeclarationOnly
      ),
      syncGenerators: ['@nx/js:typescript-sync'],
      metadata: {
        technologies: ['typescript'],
        description: 'Builds the project with `tsc`.',
        help: {
          command: `${pmc.exec} tsc --build --help`,
          example: {
            args: ['--force'],
          },
        },
      },
    };

    addBuildAndWatchDepsTargets(
      context.workspaceRoot,
      projectRoot,
      targets,
      {
        buildDepsTargetName: options.build.buildDepsName,
        watchDepsTargetName: options.build.watchDepsName,
      },
      pmc
    );
  }

  return { targets };
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs'],
  configFilePath: string,
  tsConfig: ParsedTsconfigData,
  internalProjectReferences: Record<string, ParsedTsconfigData>,
  workspaceRoot: string,
  projectRoot: string
): TargetConfiguration['inputs'] {
  const configFiles = new Set<string>();
  const externalDependencies = ['typescript'];

  const extendedConfigFiles = getExtendedConfigFiles(tsConfig, workspaceRoot);
  extendedConfigFiles.files.forEach((configPath) => {
    configFiles.add(configPath);
  });
  externalDependencies.push(...extendedConfigFiles.packages);

  const includePaths = new Set<string>();
  const excludePaths = new Set<string>();
  const projectTsConfigFiles: [string, ParsedTsconfigData][] = [
    [configFilePath, tsConfig],
    ...Object.entries(internalProjectReferences),
  ];
  const absoluteProjectRoot = join(workspaceRoot, projectRoot);

  if (!ts) {
    ts = require('typescript');
  }
  // https://github.com/microsoft/TypeScript/blob/19b777260b26aac5707b1efd34202054164d4a9d/src/compiler/utilities.ts#L9869
  const supportedTSExtensions: readonly Extension[] = [
    ts.Extension.Ts,
    ts.Extension.Tsx,
    ts.Extension.Dts,
    ts.Extension.Cts,
    ts.Extension.Dcts,
    ts.Extension.Mts,
    ts.Extension.Dmts,
  ];
  // https://github.com/microsoft/TypeScript/blob/19b777260b26aac5707b1efd34202054164d4a9d/src/compiler/utilities.ts#L9878
  const allSupportedExtensions: readonly Extension[] = [
    ts.Extension.Ts,
    ts.Extension.Tsx,
    ts.Extension.Dts,
    ts.Extension.Js,
    ts.Extension.Jsx,
    ts.Extension.Cts,
    ts.Extension.Dcts,
    ts.Extension.Cjs,
    ts.Extension.Mts,
    ts.Extension.Dmts,
    ts.Extension.Mjs,
  ];

  const normalizeInput = (
    input: string,
    config: ParsedTsconfigData
  ): string[] => {
    const extensions = config.options.allowJs
      ? [...allSupportedExtensions]
      : [...supportedTSExtensions];
    if (config.options.resolveJsonModule) {
      extensions.push(ts.Extension.Json);
    }

    const segments = input.split('/');
    // An "includes" path "foo" is implicitly a glob "foo/**/*" if its last
    // segment has no extension, and does not contain any glob characters
    // itself.
    // https://github.com/microsoft/TypeScript/blob/19b777260b26aac5707b1efd34202054164d4a9d/src/compiler/utilities.ts#L9577-L9585
    if (!/[.*?]/.test(segments.at(-1))) {
      return extensions.map((ext) => `${segments.join('/')}/**/*${ext}`);
    }

    return [input];
  };

  projectTsConfigFiles.forEach(([configPath, config]) => {
    configFiles.add(configPath);
    const offset = relative(absoluteProjectRoot, dirname(configPath));
    (config.raw?.include ?? []).forEach((p: string) => {
      const normalized = normalizeInput(join(offset, p), config);
      normalized.forEach((input) => includePaths.add(input));
    });

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
              picomatch(normalize(excludePath))(normalize(includePath)) ||
              picomatch(normalize(includePath))(normalize(excludePath))
          )
        ) {
          excludePaths.add(excludePath);
        }
      });
    }
  });

  const inputs: TargetConfiguration['inputs'] = [];
  if (includePaths.size) {
    if (existsSync(join(workspaceRoot, projectRoot, 'package.json'))) {
      inputs.push('{projectRoot}/package.json');
    }
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

  if (
    hasExternalProjectReferences(
      configFilePath,
      tsConfig,
      workspaceRoot,
      projectRoot
    )
  ) {
    // Importing modules from a referenced project will load its output declaration files (d.ts)
    // https://www.typescriptlang.org/docs/handbook/project-references.html#what-is-a-project-reference
    inputs.push({ dependentTasksOutputFiles: '**/*.d.ts' });
  } else {
    inputs.push('production' in namedInputs ? '^production' : '^default');
  }

  inputs.push({ externalDependencies });

  return inputs;
}

function getOutputs(
  configFilePath: string,
  tsConfig: ParsedTsconfigData,
  internalProjectReferences: Record<string, ParsedTsconfigData>,
  workspaceRoot: string,
  projectRoot: string,
  emitDeclarationOnly: boolean
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
        pathToInputOrOutput(config.options.outFile, workspaceRoot, projectRoot)
      );
      // outFile is not be used with .cjs, .mjs, .jsx, so the list is simpler
      const outDir = relative(workspaceRoot, outFileDir);
      outputs.add(
        pathToInputOrOutput(
          joinPathFragments(outDir, `${outFileName}.js.map`),
          workspaceRoot,
          projectRoot
        )
      );
      outputs.add(
        pathToInputOrOutput(
          joinPathFragments(outDir, `${outFileName}.d.ts`),
          workspaceRoot,
          projectRoot
        )
      );
      outputs.add(
        pathToInputOrOutput(
          joinPathFragments(outDir, `${outFileName}.d.ts.map`),
          workspaceRoot,
          projectRoot
        )
      );
      // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
      outputs.add(
        tsConfig.options.tsBuildInfoFile
          ? pathToInputOrOutput(
              tsConfig.options.tsBuildInfoFile,
              workspaceRoot,
              projectRoot
            )
          : pathToInputOrOutput(
              joinPathFragments(outDir, `${outFileName}.tsbuildinfo`),
              workspaceRoot,
              projectRoot
            )
      );
    } else if (config.options.outDir) {
      if (emitDeclarationOnly) {
        outputs.add(
          pathToInputOrOutput(
            joinPathFragments(config.options.outDir, '**/*.d.ts'),
            workspaceRoot,
            projectRoot
          )
        );
        if (tsConfig.options.declarationMap) {
          outputs.add(
            pathToInputOrOutput(
              joinPathFragments(config.options.outDir, '**/*.d.ts.map'),
              workspaceRoot,
              projectRoot
            )
          );
        }
      } else {
        outputs.add(
          pathToInputOrOutput(config.options.outDir, workspaceRoot, projectRoot)
        );
      }

      if (config.options.tsBuildInfoFile) {
        if (
          emitDeclarationOnly ||
          !normalize(config.options.tsBuildInfoFile).startsWith(
            `${normalize(config.options.outDir)}${sep}`
          )
        ) {
          // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
          outputs.add(
            pathToInputOrOutput(
              config.options.tsBuildInfoFile,
              workspaceRoot,
              projectRoot
            )
          );
        }
      } else if (config.options.rootDir && config.options.rootDir !== '.') {
        // If rootDir is set, then the tsbuildinfo file will be outside the outDir so we need to add it.
        const relativeRootDir = relative(
          config.options.rootDir,
          join(workspaceRoot, projectRoot)
        );
        outputs.add(
          pathToInputOrOutput(
            joinPathFragments(
              config.options.outDir,
              relativeRootDir,
              `*.tsbuildinfo`
            ),
            workspaceRoot,
            projectRoot
          )
        );
      } else if (emitDeclarationOnly) {
        // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
        const name = basename(configFilePath, '.json');
        outputs.add(
          pathToInputOrOutput(
            joinPathFragments(config.options.outDir, `${name}.tsbuildinfo`),
            workspaceRoot,
            projectRoot
          )
        );
      }
    } else if (
      config.raw?.include?.length ||
      config.raw?.files?.length ||
      (!config.raw?.include && !config.raw?.files)
    ) {
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
  const fullProjectRoot = resolve(workspaceRoot, projectRoot);
  const fullPath = resolve(workspaceRoot, path);
  const pathRelativeToProjectRoot = normalizePath(
    relative(fullProjectRoot, fullPath)
  );
  if (pathRelativeToProjectRoot.startsWith('..')) {
    return joinPathFragments(
      '{workspaceRoot}',
      relative(workspaceRoot, fullPath)
    );
  }

  return joinPathFragments('{projectRoot}', pathRelativeToProjectRoot);
}

function getExtendedConfigFiles(
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  extendedConfigFiles = new Set<string>(),
  extendedExternalPackages = new Set<string>()
): {
  files: string[];
  packages: string[];
} {
  for (const extendedConfigFile of tsConfig.extendedConfigFiles) {
    if (extendedConfigFile.externalPackage) {
      extendedExternalPackages.add(extendedConfigFile.externalPackage);
    } else if (extendedConfigFile.filePath) {
      extendedConfigFiles.add(extendedConfigFile.filePath);
      getExtendedConfigFiles(
        retrieveTsConfigFromCache(extendedConfigFile.filePath, workspaceRoot),
        workspaceRoot,
        extendedConfigFiles,
        extendedExternalPackages
      );
    }
  }

  return {
    files: Array.from(extendedConfigFiles),
    packages: Array.from(extendedExternalPackages),
  };
}

function resolveInternalProjectReferences(
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  projectRoot: string,
  projectReferences: Record<string, ParsedTsconfigData> = {}
): Record<string, ParsedTsconfigData> {
  if (!tsConfig.projectReferences?.length) {
    return {};
  }

  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (projectReferences[refConfigPath]) {
      // Already resolved
      continue;
    }

    if (!existsSync(refConfigPath)) {
      // the referenced tsconfig doesn't exist, ignore it
      continue;
    }

    if (isExternalProjectReference(refConfigPath, workspaceRoot, projectRoot)) {
      continue;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }
    projectReferences[refConfigPath] = retrieveTsConfigFromCache(
      refConfigPath,
      workspaceRoot
    );

    resolveInternalProjectReferences(
      projectReferences[refConfigPath],
      workspaceRoot,
      projectRoot,
      projectReferences
    );
  }

  return projectReferences;
}

function resolveShallowExternalProjectReferences(
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  projectRoot: string,
  projectReferences: Record<string, ParsedTsconfigData> = {}
): Record<string, ParsedTsconfigData> {
  if (!tsConfig.projectReferences?.length) {
    return projectReferences;
  }

  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (projectReferences[refConfigPath]) {
      // Already resolved
      continue;
    }

    if (!existsSync(refConfigPath)) {
      // the referenced tsconfig doesn't exist, ignore it
      continue;
    }

    if (isExternalProjectReference(refConfigPath, workspaceRoot, projectRoot)) {
      if (!refConfigPath.endsWith('.json')) {
        refConfigPath = join(refConfigPath, 'tsconfig.json');
      }
      projectReferences[refConfigPath] = retrieveTsConfigFromCache(
        refConfigPath,
        workspaceRoot
      );
    }
  }

  return projectReferences;
}

function hasExternalProjectReferences(
  tsConfigPath: string,
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  projectRoot: string,
  seen = new Set<string>()
): boolean {
  if (!tsConfig.projectReferences?.length) {
    return false;
  }
  seen.add(tsConfigPath);

  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (seen.has(refConfigPath)) {
      // Already seen
      continue;
    }

    if (!existsSync(refConfigPath)) {
      // the referenced tsconfig doesn't exist, ignore it
      continue;
    }

    if (isExternalProjectReference(refConfigPath, workspaceRoot, projectRoot)) {
      return true;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }
    const refTsConfig = retrieveTsConfigFromCache(refConfigPath, workspaceRoot);
    const result = hasExternalProjectReferences(
      refConfigPath,
      refTsConfig,
      workspaceRoot,
      projectRoot,
      seen
    );

    if (result) {
      return true;
    }
  }

  return false;
}

function isExternalProjectReference(
  refTsConfigPath: string,
  workspaceRoot: string,
  projectRoot: string
): boolean {
  const relativePath = posixRelative(workspaceRoot, refTsConfigPath);
  if (cache.isExternalProjectReference[relativePath] !== undefined) {
    return cache.isExternalProjectReference[relativePath];
  }

  const absoluteProjectRoot = join(workspaceRoot, projectRoot);

  let currentPath = getTsConfigDirName(refTsConfigPath);

  if (relative(absoluteProjectRoot, currentPath).startsWith('..')) {
    // it's outside of the project root, so it's an external project reference
    cache.isExternalProjectReference[relativePath] = true;
    return true;
  }

  while (currentPath !== absoluteProjectRoot) {
    if (
      existsSync(join(currentPath, 'package.json')) ||
      existsSync(join(currentPath, 'project.json'))
    ) {
      // it's inside a nested project root, so it's and external project reference
      cache.isExternalProjectReference[relativePath] = true;
      return true;
    }
    currentPath = dirname(currentPath);
  }

  // it's inside the project root, so it's an internal project reference
  cache.isExternalProjectReference[relativePath] = false;
  return false;
}

function getTsConfigDirName(tsConfigPath: string): string {
  return statSync(tsConfigPath).isFile()
    ? dirname(tsConfigPath)
    : normalize(tsConfigPath);
}

function retrieveTsConfigFromCache(
  tsConfigPath: string,
  workspaceRoot: string
): ParsedTsconfigData {
  const relativePath = posixRelative(workspaceRoot, tsConfigPath);

  // we don't need to check the hash if it's in the cache, because we've already
  // checked it when we initially populated the cache
  return tsConfigCacheData[relativePath]
    ? tsConfigCacheData[relativePath].data
    : readTsConfigAndCache(tsConfigPath, workspaceRoot);
}

function initializeTsConfigCache(
  configFilePaths: readonly string[],
  workspaceRoot: string
): void {
  tsConfigCacheData = toAbsolutePaths(readTsConfigCacheData(), workspaceRoot);

  // ensure hashes are checked and the cache is invalidated and populated as needed
  for (const configFilePath of configFilePaths) {
    const fullConfigPath = join(workspaceRoot, configFilePath);
    readTsConfigAndCache(fullConfigPath, workspaceRoot);
  }
}

function readTsConfigAndCache(
  tsConfigPath: string,
  workspaceRoot: string
): ParsedTsconfigData {
  const relativePath = posixRelative(workspaceRoot, tsConfigPath);
  const hash = getFileHash(tsConfigPath, workspaceRoot);

  let extendedFilesHash: string;
  if (
    tsConfigCacheData[relativePath] &&
    tsConfigCacheData[relativePath].hash === hash
  ) {
    extendedFilesHash = getExtendedFilesHash(
      tsConfigCacheData[relativePath].data.extendedConfigFiles,
      workspaceRoot
    );
    if (
      tsConfigCacheData[relativePath].extendedFilesHash === extendedFilesHash
    ) {
      return tsConfigCacheData[relativePath].data;
    }
  }

  const tsConfig = readTsConfig(tsConfigPath, workspaceRoot);
  const extendedConfigFiles: ExtendedConfigFile[] = [];
  if (tsConfig.raw?.extends) {
    const extendsArray =
      typeof tsConfig.raw.extends === 'string'
        ? [tsConfig.raw.extends]
        : tsConfig.raw.extends;
    for (const extendsPath of extendsArray) {
      const extendedConfigFile = resolveExtendedTsConfigPath(
        extendsPath,
        dirname(tsConfigPath)
      );
      if (extendedConfigFile) {
        extendedConfigFiles.push(extendedConfigFile);
      }
    }
  }
  extendedFilesHash ??= getExtendedFilesHash(
    extendedConfigFiles,
    workspaceRoot
  );

  tsConfigCacheData[relativePath] = {
    data: {
      options: tsConfig.options,
      projectReferences: tsConfig.projectReferences,
      raw: tsConfig.raw,
      extendedConfigFiles,
    },
    hash,
    extendedFilesHash,
  };

  return tsConfigCacheData[relativePath].data;
}

function getExtendedFilesHash(
  extendedConfigFiles: ExtendedConfigFile[],
  workspaceRoot: string
): string {
  const hashes: string[] = [];
  if (!extendedConfigFiles.length) {
    return '';
  }

  for (const extendedConfigFile of extendedConfigFiles) {
    if (extendedConfigFile.externalPackage) {
      hashes.push(extendedConfigFile.externalPackage);
    } else if (extendedConfigFile.filePath) {
      hashes.push(getFileHash(extendedConfigFile.filePath, workspaceRoot));
      hashes.push(
        getExtendedFilesHash(
          readTsConfigAndCache(extendedConfigFile.filePath, workspaceRoot)
            .extendedConfigFiles,
          workspaceRoot
        )
      );
    }
  }

  return hashes.join('|');
}

function readTsConfig(
  tsConfigPath: string,
  workspaceRoot: string
): ParsedCommandLine {
  if (!ts) {
    ts = require('typescript');
  }

  const tsSys: System = {
    ...ts.sys,
    readFile: (path) => readFile(path, workspaceRoot),
    readDirectory: () => [],
  };
  const readResult = ts.readConfigFile(tsConfigPath, tsSys.readFile);

  // read with a custom host that won't read directories which is only used
  // to identify the filenames included in the program, which we won't use
  return ts.parseJsonConfigFileContent(
    readResult.config,
    tsSys,
    dirname(tsConfigPath)
  );
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
    buildDepsName: 'build-deps',
    watchDepsName: 'watch-deps',
  };
  // Build target is not enabled by default
  if (!pluginOptions.build) {
    build = false;
  } else if (pluginOptions.build && typeof pluginOptions.build !== 'boolean') {
    build = {
      targetName: pluginOptions.build.targetName ?? defaultBuildTargetName,
      configName: pluginOptions.build.configName ?? defaultBuildConfigName,
      buildDepsName: pluginOptions.build.buildDepsName ?? 'build-deps',
      watchDepsName: pluginOptions.build.watchDepsName ?? 'watch-deps',
    };
  }

  return {
    typecheck,
    build,
    verboseOutput: pluginOptions.verboseOutput ?? false,
  };
}

function resolveExtendedTsConfigPath(
  tsConfigPath: string,
  directory?: string
): ExtendedConfigFile | null {
  try {
    const resolvedPath = require.resolve(tsConfigPath, {
      paths: directory ? [directory] : undefined,
    });

    if (
      tsConfigPath.startsWith('.') ||
      !resolvedPath.includes('/node_modules/')
    ) {
      return { filePath: resolvedPath };
    }

    // parse the package from the tsconfig path
    const packageName = tsConfigPath.startsWith('@')
      ? tsConfigPath.split('/').slice(0, 2).join('/')
      : tsConfigPath.split('/')[0];

    return { filePath: resolvedPath, externalPackage: packageName };
  } catch {
    return null;
  }
}

function getFileHash(filePath: string, workspaceRoot: string): string {
  const relativePath = posixRelative(workspaceRoot, filePath);
  if (!cache.fileHashes[relativePath]) {
    const content = readFile(filePath, workspaceRoot);
    cache.fileHashes[relativePath] = hashArray([content]);
  }

  return cache.fileHashes[relativePath];
}

function readFile(filePath: string, workspaceRoot: string): string {
  const relativePath = posixRelative(workspaceRoot, filePath);
  if (!cache.rawFiles[relativePath]) {
    const content = readFileSync(filePath, 'utf8');
    cache.rawFiles[relativePath] = content;
  }

  return cache.rawFiles[relativePath];
}

function toAbsolutePaths(
  cache: Record<string, TsconfigCacheData>,
  workspaceRoot: string
): Record<string, TsconfigCacheData> {
  const updatedCache: Record<string, TsconfigCacheData> = {};
  for (const [key, { data, extendedFilesHash, hash }] of Object.entries(
    cache
  )) {
    updatedCache[key] = {
      data: {
        options: { noEmit: data.options.noEmit },
        raw: {
          nx: { addTypecheckTarget: data.raw?.['nx']?.addTypecheckTarget },
        },
        extendedConfigFiles: data.extendedConfigFiles,
      },
      extendedFilesHash,
      hash,
    };
    if (data.options.rootDir) {
      updatedCache[key].data.options.rootDir = join(
        workspaceRoot,
        data.options.rootDir
      );
    }
    if (data.options.outDir) {
      updatedCache[key].data.options.outDir = join(
        workspaceRoot,
        data.options.outDir
      );
    }
    if (data.options.outFile) {
      updatedCache[key].data.options.outFile = join(
        workspaceRoot,
        data.options.outFile
      );
    }
    if (data.options.tsBuildInfoFile) {
      updatedCache[key].data.options.tsBuildInfoFile = join(
        workspaceRoot,
        data.options.tsBuildInfoFile
      );
    }
    if (data.extendedConfigFiles.length) {
      updatedCache[key].data.extendedConfigFiles.forEach((file) => {
        file.filePath = join(workspaceRoot, file.filePath);
      });
    }
    if (data.projectReferences) {
      updatedCache[key].data.projectReferences = data.projectReferences.map(
        (ref) => ({ ...ref, path: join(workspaceRoot, ref.path) })
      );
    }
  }

  return updatedCache;
}

function toRelativePaths(
  cache: Record<string, TsconfigCacheData>,
  workspaceRoot: string
): Record<string, TsconfigCacheData> {
  const updatedCache: Record<string, TsconfigCacheData> = {};
  for (const [key, { data, extendedFilesHash, hash }] of Object.entries(
    cache
  )) {
    updatedCache[key] = {
      data: {
        options: { noEmit: data.options.noEmit },
        raw: {
          nx: { addTypecheckTarget: data.raw?.['nx']?.addTypecheckTarget },
        },
        extendedConfigFiles: data.extendedConfigFiles,
      },
      extendedFilesHash,
      hash,
    };
    if (data.options.rootDir) {
      updatedCache[key].data.options.rootDir = posixRelative(
        workspaceRoot,
        data.options.rootDir
      );
    }
    if (data.options.outDir) {
      updatedCache[key].data.options.outDir = posixRelative(
        workspaceRoot,
        data.options.outDir
      );
    }
    if (data.options.outFile) {
      updatedCache[key].data.options.outFile = posixRelative(
        workspaceRoot,
        data.options.outFile
      );
    }
    if (data.options.tsBuildInfoFile) {
      updatedCache[key].data.options.tsBuildInfoFile = posixRelative(
        workspaceRoot,
        data.options.tsBuildInfoFile
      );
    }
    if (data.extendedConfigFiles.length) {
      updatedCache[key].data.extendedConfigFiles.forEach((file) => {
        file.filePath = posixRelative(workspaceRoot, file.filePath);
      });
    }
    if (data.projectReferences) {
      updatedCache[key].data.projectReferences = data.projectReferences.map(
        (ref) => ({
          ...ref,
          path: posixRelative(workspaceRoot, ref.path),
        })
      );
    }
  }

  return updatedCache;
}

function posixRelative(workspaceRoot: string, path: string): string {
  return posix.normalize(relative(workspaceRoot, path));
}
