import {
  createNodesFromFiles,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  readJsonFile,
  writeJsonFile,
  type CreateDependencies,
  type CreateNodesContextV2,
  type CreateNodesV2,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
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
} from './util.js';

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
        skipBuildCheck?: boolean;
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
        skipBuildCheck?: boolean;
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

interface ProjectContext {
  root: string;
  normalized: string;
  absolute: string;
}

interface ConfigContext {
  originalPath: string;
  absolutePath: string;
  relativePath: string;
  basename: string;
  basenameNoExt: string;
  dirname: string;
  project: ProjectContext;
}

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
  picomatchMatchers: Record<string, (input: string) => boolean>;
  extendedFilesHashes: Map<string, string>;
  configOwners: Map<string, string>;
  projectContexts: Map<string, ProjectContext>;
  configContexts: Map<string, ConfigContext>;
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
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const unique = (Math.random().toString(16) + '00000000').slice(2, 10);
    const tempPath = `${cachePath}.${process.pid}.${unique}.tmp`;
    try {
      writeJsonFile(tempPath, data, { spaces: 0 });
      renameSync(tempPath, cachePath);
      return;
    } catch {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
  }
}
function writeTsConfigCache(data: Record<string, TsconfigCacheData>) {
  writeToCache(TS_CONFIG_CACHE_PATH, {
    version: TSCONFIG_CACHE_VERSION,
    data,
  });
}

function createConfigContext(
  configFilePath: string,
  workspaceRoot: string,
  projectContext: ProjectContext
): ConfigContext {
  const absolutePath = join(workspaceRoot, configFilePath);

  return {
    originalPath: configFilePath,
    absolutePath,
    relativePath: posix.relative(workspaceRoot, absolutePath),
    basename: basename(configFilePath),
    basenameNoExt: basename(configFilePath, '.json'),
    dirname: dirname(absolutePath),
    project: projectContext,
  };
}

function getConfigContext(
  configPath: string,
  workspaceRoot: string
): ConfigContext {
  const absolutePath =
    configPath.startsWith('/') || configPath.startsWith(workspaceRoot)
      ? normalize(configPath)
      : join(workspaceRoot, configPath);

  let context = cache.configContexts.get(absolutePath);
  if (context) {
    return context;
  }

  const relativePath = relative(workspaceRoot, absolutePath);
  const projectRoot = dirname(relativePath);

  if (!cache.projectContexts.has(projectRoot)) {
    cache.projectContexts.set(projectRoot, {
      root: projectRoot,
      normalized: posix.normalize(projectRoot),
      absolute: join(workspaceRoot, projectRoot),
    });
  }

  const newContext = createConfigContext(
    relativePath,
    workspaceRoot,
    cache.projectContexts.get(projectRoot)!
  );

  cache.configContexts.set(absolutePath, newContext);
  return newContext;
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
    cache = {
      fileHashes: {},
      rawFiles: {},
      picomatchMatchers: {},
      extendedFilesHashes: new Map(),
      configOwners: new Map(),
      projectContexts: new Map(),
      configContexts: new Map(),
    };
    initializeTsConfigCache(configFilePaths, context.workspaceRoot);

    const normalizedOptions = normalizePluginOptions(options);

    const {
      configFilePaths: validConfigFilePaths,
      hashes,
      projectRoots,
    } = await resolveValidConfigFilesAndHashes(
      configFilePaths,
      normalizedOptions,
      optionsHash,
      context
    );

    try {
      return await createNodesFromFiles(
        (configFilePath, options, context, idx) => {
          const projectRoot = projectRoots[idx];
          const hash = hashes[idx];
          const cacheKey = `${hash}_${configFilePath}`;

          const absolutePath = join(context.workspaceRoot, configFilePath);
          const configContext = getConfigContext(
            absolutePath,
            context.workspaceRoot
          );

          targetsCache[cacheKey] ??= buildTscTargets(
            configContext,
            options,
            context,
            validConfigFilePaths
          );

          const { targets } = targetsCache[cacheKey];

          return {
            projects: {
              [projectRoot]: {
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
      // Release memory after plugin invocation
      cache = null as any;
    }
  },
];

export const createNodes = createNodesV2;

async function resolveValidConfigFilesAndHashes(
  configFilePaths: readonly string[],
  options: NormalizedPluginOptions,
  optionsHash: string,
  context: CreateNodesContextV2
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
    const absolutePath = join(context.workspaceRoot, configFilePath);
    const configContext = getConfigContext(absolutePath, context.workspaceRoot);

    // Skip configs that can't produce any targets based on plugin options
    const isTypecheckConfig = configContext.basename === 'tsconfig.json';
    const isBuildConfig =
      options.build && configContext.basename === options.build.configName;
    if (!isTypecheckConfig && !isBuildConfig) {
      continue;
    }

    if (!checkIfConfigFileShouldBeProject(configContext)) {
      continue;
    }

    projectRoots.push(projectRoot);
    validConfigFilePaths.push(configFilePath);
    hashes.push(
      await getConfigFileHash(
        configFilePath,
        context.workspaceRoot,
        configContext.project,
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
  project: ProjectContext,
  optionsHash: string,
  lockFileHash: string
): Promise<string> {
  const fullConfigPath = join(workspaceRoot, configFilePath);

  const tsConfig = retrieveTsConfigFromCache(fullConfigPath, workspaceRoot);
  const extendedConfigFiles = getExtendedConfigFiles(tsConfig, workspaceRoot);
  const internalReferencedFiles = resolveInternalProjectReferences(
    tsConfig,
    workspaceRoot,
    project
  );
  const externalProjectReferences = resolveShallowExternalProjectReferences(
    tsConfig,
    workspaceRoot,
    project
  );

  let packageJson = null;
  try {
    packageJson = readJsonFile(
      join(workspaceRoot, project.root, 'package.json')
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
  ]);
}

function checkIfConfigFileShouldBeProject(config: ConfigContext): boolean {
  // Do not create a project for the workspace root tsconfig files.
  if (config.project.root === '.') {
    return false;
  }

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(config.project.absolute);
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return false;
  }

  cache.configOwners.set(config.relativePath, config.project.normalized);

  // Do not create a project if it's not a tsconfig.json and there is no tsconfig.json in the same directory
  if (
    config.basename !== 'tsconfig.json' &&
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
  config: ConfigContext,
  options: NormalizedPluginOptions,
  context: CreateNodesContextV2,
  configFiles: readonly string[]
) {
  const targets: Record<string, TargetConfiguration> = {};
  const namedInputs = getNamedInputs(config.project.root, context);
  const tsConfig = retrieveTsConfigFromCache(
    config.absolutePath,
    context.workspaceRoot
  );

  let internalProjectReferences: Record<string, ParsedTsconfigData>;
  if (
    config.basename === 'tsconfig.json' &&
    options.typecheck &&
    tsConfig.raw?.['nx']?.addTypecheckTarget !== false
  ) {
    internalProjectReferences = resolveInternalProjectReferences(
      tsConfig,
      context.workspaceRoot,
      config.project
    );
    const externalProjectReferences = resolveShallowExternalProjectReferences(
      tsConfig,
      context.workspaceRoot,
      config.project
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
          config.project.root,
          options.build.configName
        );
        if (
          configFiles.some((f) => f === buildConfigPath) &&
          (options.build.skipBuildCheck ||
            isValidPackageJsonBuildConfig(
              retrieveTsConfigFromCache(buildConfigPath, context.workspaceRoot),
              context.workspaceRoot,
              config.project.root
            ))
        ) {
          dependsOn.unshift(options.build.targetName);
        }
      }

      targets[targetName] = {
        dependsOn,
        command,
        options: { cwd: config.project.root },
        cache: true,
        inputs: getInputs(
          namedInputs,
          config,
          tsConfig,
          internalProjectReferences,
          context.workspaceRoot
        ),
        outputs: getOutputs(
          config,
          tsConfig,
          internalProjectReferences,
          context.workspaceRoot,
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
    config.basename === options.build.configName &&
    (options.build.skipBuildCheck ||
      isValidPackageJsonBuildConfig(
        tsConfig,
        context.workspaceRoot,
        config.project.root
      ))
  ) {
    internalProjectReferences ??= resolveInternalProjectReferences(
      tsConfig,
      context.workspaceRoot,
      config.project
    );
    const targetName = options.build.targetName;

    targets[targetName] = {
      dependsOn: [`^${targetName}`],
      command: `tsc --build ${options.build.configName}${
        options.verboseOutput ? ' --verbose' : ''
      }`,
      options: { cwd: config.project.root },
      cache: true,
      inputs: getInputs(
        namedInputs,
        config,
        tsConfig,
        internalProjectReferences,
        context.workspaceRoot
      ),
      outputs: getOutputs(
        config,
        tsConfig,
        internalProjectReferences,
        context.workspaceRoot,
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
      config.project.root,
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
  config: ConfigContext,
  tsConfig: ParsedTsconfigData,
  internalProjectReferences: Record<string, ParsedTsconfigData>,
  workspaceRoot: string
): TargetConfiguration['inputs'] {
  const configFiles = new Set<string>();
  // TODO(leo): temporary disable external dependencies until we support hashing
  // glob patterns from external dependencies
  // const externalDependencies = ['typescript'];

  const extendedConfigFiles = getExtendedConfigFiles(tsConfig, workspaceRoot);
  extendedConfigFiles.files.forEach((configPath) => {
    configFiles.add(configPath);
  });
  // externalDependencies.push(...extendedConfigFiles.packages);

  const includePaths = new Set<string>();
  const excludePaths = new Set<string>();
  const projectTsConfigFiles: [string, ParsedTsconfigData][] = [
    [config.originalPath, tsConfig],
    ...Object.entries(internalProjectReferences),
  ];
  const absoluteProjectRoot = config.project.absolute;

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

  const configDirTemplate = '${configDir}';
  const substituteConfigDir = (p: string) =>
    p.startsWith(configDirTemplate) ? p.replace(configDirTemplate, './') : p;

  // Helper function to get or create cached picomatch matchers
  const getOrCreateMatcher = (pattern: string) => {
    if (!cache.picomatchMatchers[pattern]) {
      cache.picomatchMatchers[pattern] = picomatch(pattern);
    }
    return cache.picomatchMatchers[pattern];
  };

  projectTsConfigFiles.forEach(([configPath, tsconfig]) => {
    configFiles.add(configPath);
    const offset = relative(absoluteProjectRoot, dirname(configPath));
    (tsconfig.raw?.include ?? []).forEach((p: string) => {
      const normalized = normalizeInput(
        join(offset, substituteConfigDir(p)),
        tsconfig
      );
      normalized.forEach((input) => includePaths.add(input));
    });

    if (tsconfig.raw?.exclude) {
      /**
       * We need to filter out the exclude paths that are already included in
       * other tsconfig files. If they are not included in other tsconfig files,
       * they still correctly apply to the current file and we should keep them.
       */
      const otherFilesInclude: string[] = [];
      projectTsConfigFiles.forEach(([path, c]) => {
        if (path !== configPath) {
          otherFilesInclude.push(
            ...(c.raw?.include ?? []).map(substituteConfigDir)
          );
        }
      });
      const normalize = (p: string) => (p.startsWith('./') ? p.slice(2) : p);
      tsconfig.raw.exclude.forEach((e: string) => {
        const excludePath = substituteConfigDir(e);
        const normalizedExclude = normalize(excludePath);
        const excludeMatcher = getOrCreateMatcher(normalizedExclude);

        if (
          !otherFilesInclude.some((includePath) => {
            const normalizedInclude = normalize(includePath);
            const includeMatcher = getOrCreateMatcher(normalizedInclude);
            return (
              excludeMatcher(normalizedInclude) ||
              includeMatcher(normalizedExclude)
            );
          })
        ) {
          excludePaths.add(excludePath);
        }
      });
    }
  });

  const inputs: TargetConfiguration['inputs'] = [];
  if (includePaths.size) {
    if (existsSync(join(workspaceRoot, config.project.root, 'package.json'))) {
      inputs.push('{projectRoot}/package.json');
    }
    inputs.push(
      ...Array.from(configFiles).map((p: string) =>
        pathToInputOrOutput(p, workspaceRoot, config.project)
      ),
      ...Array.from(includePaths).map((p: string) =>
        pathToInputOrOutput(
          joinPathFragments(config.project.root, p),
          workspaceRoot,
          config.project
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
            joinPathFragments(config.project.root, p),
            workspaceRoot,
            config.project
          )}`
      )
    );
  }

  if (
    hasExternalProjectReferences(
      config.originalPath,
      tsConfig,
      workspaceRoot,
      config.project
    )
  ) {
    // Importing modules from a referenced project will load its output declaration files (d.ts)
    // https://www.typescriptlang.org/docs/handbook/project-references.html#what-is-a-project-reference
    inputs.push({ dependentTasksOutputFiles: '**/*.d.ts' });
  } else {
    inputs.push('production' in namedInputs ? '^production' : '^default');
  }

  // inputs.push({ externalDependencies });

  return inputs;
}

function getOutputs(
  config: ConfigContext,
  tsConfig: ParsedTsconfigData,
  internalProjectReferences: Record<string, ParsedTsconfigData>,
  workspaceRoot: string,
  emitDeclarationOnly: boolean
): string[] {
  const outputs = new Set<string>();

  // We could have more surgical outputs based on the tsconfig options, but the
  // user could override them through the command line and that wouldn't be
  // reflected in the outputs. So, we just include everything that could be
  // produced by the tsc command.
  [tsConfig, ...Object.values(internalProjectReferences)].forEach(
    (tsconfig) => {
      if (tsconfig.options.outFile) {
        const outFileName = basename(tsconfig.options.outFile, '.js');
        const outFileDir = dirname(tsconfig.options.outFile);
        outputs.add(
          pathToInputOrOutput(
            tsconfig.options.outFile,
            workspaceRoot,
            config.project
          )
        );
        // outFile is not be used with .cjs, .mjs, .jsx, so the list is simpler
        const outDir = relative(workspaceRoot, outFileDir);
        outputs.add(
          pathToInputOrOutput(
            joinPathFragments(outDir, `${outFileName}.js.map`),
            workspaceRoot,
            config.project
          )
        );
        outputs.add(
          pathToInputOrOutput(
            joinPathFragments(outDir, `${outFileName}.d.ts`),
            workspaceRoot,
            config.project
          )
        );
        outputs.add(
          pathToInputOrOutput(
            joinPathFragments(outDir, `${outFileName}.d.ts.map`),
            workspaceRoot,
            config.project
          )
        );
        // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
        outputs.add(
          tsConfig.options.tsBuildInfoFile
            ? pathToInputOrOutput(
                tsConfig.options.tsBuildInfoFile,
                workspaceRoot,
                config.project
              )
            : pathToInputOrOutput(
                joinPathFragments(outDir, `${outFileName}.tsbuildinfo`),
                workspaceRoot,
                config.project
              )
        );
      } else if (tsconfig.options.outDir) {
        if (emitDeclarationOnly) {
          outputs.add(
            pathToInputOrOutput(
              joinPathFragments(tsconfig.options.outDir, '**/*.d.ts'),
              workspaceRoot,
              config.project
            )
          );
          if (tsConfig.options.declarationMap) {
            outputs.add(
              pathToInputOrOutput(
                joinPathFragments(tsconfig.options.outDir, '**/*.d.ts.map'),
                workspaceRoot,
                config.project
              )
            );
          }
        } else {
          outputs.add(
            pathToInputOrOutput(
              tsconfig.options.outDir,
              workspaceRoot,
              config.project
            )
          );
        }

        if (tsconfig.options.tsBuildInfoFile) {
          if (
            emitDeclarationOnly ||
            !normalize(tsconfig.options.tsBuildInfoFile).startsWith(
              `${normalize(tsconfig.options.outDir)}${sep}`
            )
          ) {
            // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
            outputs.add(
              pathToInputOrOutput(
                tsconfig.options.tsBuildInfoFile,
                workspaceRoot,
                config.project
              )
            );
          }
        } else if (
          tsconfig.options.rootDir &&
          tsconfig.options.rootDir !== '.'
        ) {
          // If rootDir is set, then the tsbuildinfo file will be outside the outDir so we need to add it.
          const relativeRootDir = relative(
            tsconfig.options.rootDir,
            join(workspaceRoot, config.project.root)
          );
          outputs.add(
            pathToInputOrOutput(
              joinPathFragments(
                tsconfig.options.outDir,
                relativeRootDir,
                `*.tsbuildinfo`
              ),
              workspaceRoot,
              config.project
            )
          );
        } else if (emitDeclarationOnly) {
          // https://www.typescriptlang.org/tsconfig#tsBuildInfoFile
          const name = config.basenameNoExt;
          outputs.add(
            pathToInputOrOutput(
              joinPathFragments(tsconfig.options.outDir, `${name}.tsbuildinfo`),
              workspaceRoot,
              config.project
            )
          );
        }
      } else if (
        tsconfig.raw?.include?.length ||
        tsconfig.raw?.files?.length ||
        (!tsconfig.raw?.include && !tsconfig.raw?.files)
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
        const name = config.basenameNoExt;
        outputs.add(
          tsConfig.options.tsBuildInfoFile
            ? pathToInputOrOutput(
                tsConfig.options.tsBuildInfoFile,
                workspaceRoot,
                config.project
              )
            : joinPathFragments('{projectRoot}', `${name}.tsbuildinfo`)
        );
      }
    }
  );

  return Array.from(outputs);
}

function pathToInputOrOutput(
  path: string,
  workspaceRoot: string,
  project: ProjectContext
): string {
  const fullProjectRoot = project.absolute;
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
  project: ProjectContext,
  projectReferences: Record<string, ParsedTsconfigData> = {}
): Record<string, ParsedTsconfigData> {
  if (!tsConfig.projectReferences?.length) {
    return {};
  }

  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (projectReferences[refConfigPath]) {
      continue;
    }

    if (!existsSync(refConfigPath)) {
      continue;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }

    const refContext = getConfigContext(refConfigPath, workspaceRoot);

    if (isExternalProjectReference(refContext, project, workspaceRoot)) {
      continue;
    }
    projectReferences[refConfigPath] = retrieveTsConfigFromCache(
      refConfigPath,
      workspaceRoot
    );

    resolveInternalProjectReferences(
      projectReferences[refConfigPath],
      workspaceRoot,
      project,
      projectReferences
    );
  }

  return projectReferences;
}

function resolveShallowExternalProjectReferences(
  tsConfig: ParsedTsconfigData,
  workspaceRoot: string,
  project: ProjectContext,
  projectReferences: Record<string, ParsedTsconfigData> = {}
): Record<string, ParsedTsconfigData> {
  if (!tsConfig.projectReferences?.length) {
    return projectReferences;
  }

  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (projectReferences[refConfigPath]) {
      continue;
    }

    if (!existsSync(refConfigPath)) {
      continue;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }

    const refContext = getConfigContext(refConfigPath, workspaceRoot);

    if (isExternalProjectReference(refContext, project, workspaceRoot)) {
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
  project: ProjectContext,
  seen = new Set<string>()
): boolean {
  if (!tsConfig.projectReferences?.length) {
    return false;
  }
  seen.add(tsConfigPath);

  for (const ref of tsConfig.projectReferences) {
    let refConfigPath = ref.path;
    if (seen.has(refConfigPath)) {
      continue;
    }

    if (!existsSync(refConfigPath)) {
      continue;
    }

    if (!refConfigPath.endsWith('.json')) {
      refConfigPath = join(refConfigPath, 'tsconfig.json');
    }

    const refContext = getConfigContext(refConfigPath, workspaceRoot);

    if (isExternalProjectReference(refContext, project, workspaceRoot)) {
      return true;
    }
    const refTsConfig = retrieveTsConfigFromCache(refConfigPath, workspaceRoot);
    const result = hasExternalProjectReferences(
      refConfigPath,
      refTsConfig,
      workspaceRoot,
      project,
      seen
    );

    if (result) {
      return true;
    }
  }

  return false;
}

function isExternalProjectReference(
  refConfig: ConfigContext,
  project: ProjectContext,
  workspaceRoot: string
): boolean {
  const owner = cache.configOwners.get(refConfig.relativePath);
  if (owner !== undefined) {
    return owner !== project.normalized;
  }

  let currentPath = refConfig.dirname;

  if (relative(project.absolute, currentPath).startsWith('..')) {
    return true;
  }

  while (currentPath !== project.absolute) {
    if (
      existsSync(join(currentPath, 'package.json')) ||
      existsSync(join(currentPath, 'project.json'))
    ) {
      const owner = posixRelative(workspaceRoot, currentPath);
      cache.configOwners.set(refConfig.relativePath, owner);
      return owner !== project.normalized;
    }
    currentPath = dirname(currentPath);
  }

  return false;
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
  if (!extendedConfigFiles.length) {
    return '';
  }

  // Create a stable cache key from sorted file paths
  const cacheKey = extendedConfigFiles
    .map((f) => f.filePath || f.externalPackage)
    .filter(Boolean)
    .sort()
    .join('|');

  if (cache.extendedFilesHashes.has(cacheKey)) {
    return cache.extendedFilesHashes.get(cacheKey)!;
  }

  const hashes: string[] = [];
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

  const hash = hashes.join('|');
  cache.extendedFilesHashes.set(cacheKey, hash);

  return hash;
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
    skipBuildCheck: false,
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
      skipBuildCheck: pluginOptions.build.skipBuildCheck ?? false,
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
