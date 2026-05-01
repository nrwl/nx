import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getLockFileName, getRootTsConfigFileName } from '@nx/js';
import {
  walkTsconfigExtendsChain,
  type RawTsconfigJsonCache,
} from '@nx/js/src/internal';
import type { ESLint as ESLintType } from 'eslint';
import { existsSync } from 'node:fs';
import { relative as nativeRelative, sep as nativeSep } from 'node:path';
import { basename, dirname, join, normalize, sep } from 'node:path/posix';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { gte } from 'semver';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
  ESLINT_CONFIG_FILENAMES,
  isFlatConfig,
} from '../utils/config-file';
import { resolveESLintClass } from '../utils/resolve-eslint-class';

export interface EslintPluginOptions {
  targetName?: string;
  extensions?: string[];
}

const DEFAULT_EXTENSIONS = [
  'ts',
  'cts',
  'mts',
  'tsx',
  'js',
  'cjs',
  'mjs',
  'jsx',
  'html',
  'vue',
];
const PROJECT_CONFIG_FILENAMES = ['project.json', 'package.json'];
const ESLINT_CONFIG_GLOB_V2 = combineGlobPatterns([
  ...ESLINT_CONFIG_FILENAMES.map((f) => `**/${f}`),
  ...PROJECT_CONFIG_FILENAMES.map((f) => `**/${f}`),
]);

function readTargetsCache(
  cachePath: string
): Record<string, CreateNodesResult['projects']> {
  return process.env.NX_CACHE_PROJECT_GRAPH !== 'false' && existsSync(cachePath)
    ? readJsonFile(cachePath)
    : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, CreateNodesResult['projects']>
) {
  writeJsonFile(cachePath, results);
}

const internalCreateNodesV2 = async (
  ESLint: typeof ESLintType,
  configFilePath: string,
  options: EslintPluginOptions,
  context: CreateNodesContextV2,
  projectRootsByEslintRoots: Map<string, string[]>,
  lintableFilesPerProjectRoot: Map<string, string[]>,
  tsconfigChainsByProjectRoot: Map<string, string[]>,
  projectsCache: Record<string, CreateNodesResult['projects']>,
  hashByRoot: Map<string, string>,
  pmc: ReturnType<typeof getPackageManagerCommand>
): Promise<CreateNodesResult> => {
  const configDir = dirname(configFilePath);
  const eslintVersion = ESLint.version;

  let sharedEslint: ESLintType;
  const getEslint = (projectRoot: string) => {
    if (existsSync(join(context.workspaceRoot, projectRoot, '.eslintignore'))) {
      return new ESLint({ cwd: join(context.workspaceRoot, projectRoot) });
    }
    sharedEslint ??= new ESLint({
      cwd: join(context.workspaceRoot, configDir),
    });
    return sharedEslint;
  };

  const projects: CreateNodesResult['projects'] = {};
  await Promise.all(
    projectRootsByEslintRoots.get(configDir).map(async (projectRoot) => {
      const hash = hashByRoot.get(projectRoot);

      if (projectsCache[hash]) {
        // We can reuse the projects in the cache.
        Object.assign(projects, projectsCache[hash]);
        return;
      }

      let hasNonIgnoredLintableFiles = false;
      if (configDir !== projectRoot || projectRoot === '.') {
        const eslint = getEslint(projectRoot);
        for (const file of lintableFilesPerProjectRoot.get(projectRoot) ?? []) {
          if (
            !(await eslint.isPathIgnored(join(context.workspaceRoot, file)))
          ) {
            hasNonIgnoredLintableFiles = true;
            break;
          }
        }
      } else {
        hasNonIgnoredLintableFiles = true;
      }

      if (!hasNonIgnoredLintableFiles) {
        // No lintable files in the project, store in the cache and skip further processing
        projectsCache[hash] = {};
        return;
      }

      const project = getProjectUsingESLintConfig(
        configFilePath,
        projectRoot,
        eslintVersion,
        options,
        context,
        pmc,
        tsconfigChainsByProjectRoot.get(projectRoot) ?? []
      );

      if (project) {
        projects[projectRoot] = project;
        // Store project into the cache
        projectsCache[hash] = { [projectRoot]: project };
      } else {
        // No project found, store in the cache
        projectsCache[hash] = {};
      }
    })
  );

  return {
    projects,
  };
};

export const createNodes: CreateNodesV2<EslintPluginOptions> = [
  ESLINT_CONFIG_GLOB_V2,
  async (configFiles, options, context) => {
    options = normalizeOptions(options);
    const pmc = getPackageManagerCommand(
      detectPackageManager(context.workspaceRoot)
    );
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `eslint-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    const { eslintConfigFiles, projectRoots, projectRootsByEslintRoots } =
      splitConfigFiles(configFiles);
    const lintableFilesPerProjectRoot = await collectLintableFilesByProjectRoot(
      projectRoots,
      options,
      context
    );
    const tsconfigChainsByProjectRoot = collectTsconfigChainsByProjectRoot(
      projectRoots,
      context.workspaceRoot
    );
    const lockFilePattern = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      options,
      context,
      projectRoots.map((root) => {
        const parentConfigs = eslintConfigFiles.filter((eslintConfig) =>
          isSubDir(root, dirname(eslintConfig))
        );
        return [
          ...parentConfigs,
          join(root, '.eslintignore'),
          lockFilePattern,
          ...(tsconfigChainsByProjectRoot.get(root) ?? []),
        ];
      })
    );
    const hashByRoot = new Map<string, string>(
      projectRoots.map((r, i) => [r, hashes[i]])
    );
    try {
      if (eslintConfigFiles.length === 0) {
        return [];
      }
      // Determine flat vs legacy from root config, matching ESLint's own
      // behavior (find-up from cwd). Nested .eslintrc.* files are irrelevant
      // when a root flat config exists. Prefer flat config at root when both
      // flat and legacy root configs coexist (e.g., mid-migration).
      const rootConfigs = eslintConfigFiles.filter((f) => dirname(f) === '.');
      const rootConfig = rootConfigs.find(isFlatConfig) ?? rootConfigs[0];
      const ESLint = await resolveESLintClass({
        useFlatConfigOverrideVal: isFlatConfig(
          rootConfig ?? eslintConfigFiles[0]
        ),
      });
      return await createNodesFromFiles(
        (configFile, options, context) =>
          internalCreateNodesV2(
            ESLint,
            configFile,
            options,
            context,
            projectRootsByEslintRoots,
            lintableFilesPerProjectRoot,
            tsconfigChainsByProjectRoot,
            targetsCache,
            hashByRoot,
            pmc
          ),
        eslintConfigFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodesV2 = createNodes;

function splitConfigFiles(configFiles: readonly string[]): {
  eslintConfigFiles: string[];
  projectRoots: string[];
  projectRootsByEslintRoots: Map<string, string[]>;
} {
  const eslintConfigFiles: string[] = [];
  const projectRoots = new Set<string>();

  for (const configFile of configFiles) {
    if (PROJECT_CONFIG_FILENAMES.includes(basename(configFile))) {
      projectRoots.add(dirname(configFile));
    } else {
      eslintConfigFiles.push(configFile);
    }
  }

  const uniqueProjectRoots = Array.from(projectRoots);
  const projectRootsByEslintRoots = groupProjectRootsByEslintRoots(
    eslintConfigFiles,
    uniqueProjectRoots
  );

  return {
    eslintConfigFiles,
    projectRoots: uniqueProjectRoots,
    projectRootsByEslintRoots,
  };
}

function groupProjectRootsByEslintRoots(
  eslintConfigFiles: string[],
  projectRoots: string[]
): Map<string, string[]> {
  const projectRootsByEslintRoots = new Map<string, string[]>();
  for (const eslintConfig of eslintConfigFiles) {
    projectRootsByEslintRoots.set(dirname(eslintConfig), []);
  }

  for (const projectRoot of projectRoots) {
    const eslintRoot = getRootForDirectory(
      projectRoot,
      projectRootsByEslintRoots
    );
    if (eslintRoot) {
      projectRootsByEslintRoots.get(eslintRoot).push(projectRoot);
    }
  }

  return projectRootsByEslintRoots;
}

/**
 * For each project root that has a `tsconfig.json`, resolves its `extends`
 * chain and returns the workspace-relative paths of every reachable file
 * that lives OUTSIDE the project root. Files inside the project root are
 * already covered by `default` (`{projectRoot}/**\/*`); files resolved
 * inside `node_modules` are invalidated via the lockfile; files that
 * escape the workspace cannot be expressed as `{workspaceRoot}/...`.
 *
 * Root projects (`.`) are skipped — everything reachable from a root
 * project's tsconfig is inside the project root by definition.
 */
function collectTsconfigChainsByProjectRoot(
  projectRoots: string[],
  workspaceRoot: string
): Map<string, string[]> {
  const jsonCache: RawTsconfigJsonCache = new Map();
  const result = new Map<string, string[]>();

  // The root tsconfig (tsconfig.base.json or tsconfig.json) is already
  // handled by the native selective hasher (TsConfiguration hash
  // instruction) which only hashes the path aliases relevant to each
  // project.  Adding it as an explicit file input would bypass that
  // optimization and cause every project to be affected on any change.
  const rootTsConfigName = getRootTsConfigFileName();

  for (const projectRoot of projectRoots) {
    if (projectRoot === '.') continue;
    const tsconfigPath = join(projectRoot, 'tsconfig.json');
    if (!existsSync(join(workspaceRoot, tsconfigPath))) continue;

    const outside: string[] = [];
    const projectPrefix = `${projectRoot}/`;
    walkTsconfigExtendsChain(
      join(workspaceRoot, tsconfigPath),
      (absolutePath) => {
        const wsRelative = nativeRelative(workspaceRoot, absolutePath)
          .split(nativeSep)
          .join('/');
        if (wsRelative.startsWith('../') || wsRelative === '..') {
          return 'continue'; // escapes workspace
        }
        if (
          wsRelative.startsWith('node_modules/') ||
          wsRelative.includes('/node_modules/')
        ) {
          return 'continue'; // external package, lockfile invalidates
        }
        if (
          wsRelative === projectRoot ||
          wsRelative.startsWith(projectPrefix)
        ) {
          return 'continue'; // inside project root, covered by `default`
        }
        if (wsRelative === rootTsConfigName) {
          return 'continue'; // handled by native selective hasher
        }
        outside.push(wsRelative);
        return 'continue';
      },
      { jsonCache }
    );
    result.set(projectRoot, outside);
  }
  return result;
}

async function collectLintableFilesByProjectRoot(
  projectRoots: string[],
  options: EslintPluginOptions,
  context: CreateNodesContextV2
): Promise<Map<string, string[]>> {
  const lintableFilesPerProjectRoot = new Map<string, string[]>();

  const lintableFiles = await globWithWorkspaceContext(context.workspaceRoot, [
    `**/*.{${options.extensions.join(',')}}`,
  ]);

  for (const projectRoot of projectRoots) {
    lintableFilesPerProjectRoot.set(projectRoot, []);
  }

  for (const file of lintableFiles) {
    const projectRoot = getRootForDirectory(
      dirname(file),
      lintableFilesPerProjectRoot
    );
    if (projectRoot) {
      lintableFilesPerProjectRoot.get(projectRoot).push(file);
    }
  }

  return lintableFilesPerProjectRoot;
}

function getRootForDirectory(
  directory: string,
  roots: Map<string, string[]>
): string {
  let currentPath = normalize(directory);

  while (currentPath !== dirname(currentPath)) {
    if (roots.has(currentPath)) {
      return currentPath;
    }
    currentPath = dirname(currentPath);
  }

  return roots.has(currentPath) ? currentPath : null;
}

function getProjectUsingESLintConfig(
  configFilePath: string,
  projectRoot: string,
  eslintVersion: string,
  options: EslintPluginOptions,
  context: CreateNodesContextV2,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  tsconfigChainOutsideProjectRoot: string[]
): CreateNodesResult['projects'][string] | null {
  const rootEslintConfig = [
    baseEsLintConfigFile,
    ...BASE_ESLINT_CONFIG_FILENAMES,
    ...ESLINT_CONFIG_FILENAMES,
  ].find((f) => existsSync(join(context.workspaceRoot, f)));

  // Add a lint target for each child project without an eslint config, with the root level config as an input
  let standaloneSrcPath: string | undefined;
  if (
    projectRoot === '.' &&
    existsSync(join(context.workspaceRoot, projectRoot, 'package.json'))
  ) {
    if (existsSync(join(context.workspaceRoot, projectRoot, 'src'))) {
      standaloneSrcPath = 'src';
    } else if (existsSync(join(context.workspaceRoot, projectRoot, 'lib'))) {
      standaloneSrcPath = 'lib';
    }
  }
  if (projectRoot === '.' && !standaloneSrcPath) {
    return null;
  }

  const eslintConfigs = [configFilePath];

  if (rootEslintConfig && !eslintConfigs.includes(rootEslintConfig)) {
    eslintConfigs.unshift(rootEslintConfig);
  }

  return {
    targets: buildEslintTargets(
      eslintConfigs,
      eslintVersion,
      projectRoot,
      context.workspaceRoot,
      options,
      pmc,
      standaloneSrcPath,
      tsconfigChainOutsideProjectRoot
    ),
  };
}

function buildEslintTargets(
  eslintConfigs: string[],
  eslintVersion: string,
  projectRoot: string,
  workspaceRoot: string,
  options: EslintPluginOptions,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  standaloneSrcPath?: string,
  tsconfigChainOutsideProjectRoot: string[] = []
) {
  const isRootProject = projectRoot === '.';
  const targets: Record<string, TargetConfiguration> = {};

  const targetConfig: TargetConfiguration = {
    command: `eslint ${
      isRootProject && standaloneSrcPath ? `./${standaloneSrcPath}` : '.'
    }`,
    cache: true,
    options: {
      cwd: projectRoot,
    },
    inputs: [
      'default',
      // Certain lint rules can be impacted by changes to dependencies
      '^default',
      ...eslintConfigs.map((config) => `{workspaceRoot}/${config}`),
      ...(existsSync(join(workspaceRoot, projectRoot, '.eslintignore'))
        ? [join('{workspaceRoot}', projectRoot, '.eslintignore')]
        : []),
      // Tsconfig files reached via `extends` that live outside the project
      // root — declared so the cache invalidates on upstream changes.
      ...tsconfigChainOutsideProjectRoot.map(
        (file) => `{workspaceRoot}/${file}`
      ),
      '{workspaceRoot}/tools/eslint-rules/**/*',
      { externalDependencies: ['eslint'] },
    ],
    outputs: ['{options.outputFile}'],
    metadata: {
      technologies: ['eslint'],
      description: 'Runs ESLint on project',
      help: {
        command: `${pmc.exec} eslint --help`,
        example: {
          options: {
            'max-warnings': 0,
          },
        },
      },
    },
  };

  // Always set the environment variable to ensure that the ESLint CLI can run on eslint v8 and v9
  const useFlatConfig = eslintConfigs.some((config) => isFlatConfig(config));
  // Flat config is default for 9.0.0+
  const defaultSetting = gte(eslintVersion, '9.0.0');
  if (useFlatConfig !== defaultSetting) {
    targetConfig.options.env = {
      ESLINT_USE_FLAT_CONFIG: useFlatConfig ? 'true' : 'false',
    };
  }

  targets[options.targetName] = targetConfig;

  return targets;
}

function normalizeOptions(options: EslintPluginOptions): EslintPluginOptions {
  const normalizedOptions: EslintPluginOptions = {
    targetName: options?.targetName ?? 'lint',
  };

  // Normalize user input for extensions (strip leading . characters)
  if (Array.isArray(options?.extensions)) {
    normalizedOptions.extensions = options.extensions.map((f) =>
      f.replace(/^\.+/, '')
    );
  } else {
    normalizedOptions.extensions = DEFAULT_EXTENSIONS;
  }

  return normalizedOptions;
}

/**
 * Determines if `child` is a subdirectory of `parent`. This is a simplified
 * version that takes into account that paths are always relative to the
 * workspace root.
 */
function isSubDir(parent: string, child: string): boolean {
  if (parent === '.') {
    return true;
  }

  parent = normalize(parent);
  child = normalize(child);

  if (!parent.endsWith(sep)) {
    parent += sep;
  }

  return child.startsWith(parent);
}
