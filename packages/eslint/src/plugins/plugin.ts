import {
  CreateNodes,
  CreateNodesContext,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesResult,
  CreateNodesV2,
  getPackageManagerCommand,
  logger,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { existsSync } from 'node:fs';
import { basename, dirname, join, normalize, sep } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { gte } from 'semver';
import {
  baseEsLintConfigFile,
  baseEsLintFlatConfigFile,
  ESLINT_CONFIG_FILENAMES,
  isFlatConfig,
} from '../utils/config-file';
import { resolveESLintClass } from '../utils/resolve-eslint-class';

export interface EslintPluginOptions {
  targetName?: string;
  extensions?: string[];
}

const DEFAULT_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'html', 'vue'];
const PROJECT_CONFIG_FILENAMES = ['project.json', 'package.json'];
const ESLINT_CONFIG_GLOB_V1 = combineGlobPatterns(
  ESLINT_CONFIG_FILENAMES.map((f) => `**/${f}`)
);
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

const internalCreateNodes = async (
  configFilePath: string,
  options: EslintPluginOptions,
  context: CreateNodesContext,
  projectsCache: Record<string, CreateNodesResult['projects']>
): Promise<CreateNodesResult> => {
  options = normalizeOptions(options);
  const configDir = dirname(configFilePath);

  // Ensure that configFiles are set, e2e-run fails due to them being undefined in CI (does not occur locally)
  // TODO(JamesHenry): Further troubleshoot this in CI
  (context as any).configFiles = context.configFiles ?? [];

  // Create a Set of all the directories containing eslint configs, and a
  // list of globs to exclude from child projects
  const nestedEslintRootPatterns: string[] = [];
  for (const configFile of context.configFiles) {
    const eslintRootDir = dirname(configFile);

    if (eslintRootDir !== configDir && isSubDir(configDir, eslintRootDir)) {
      nestedEslintRootPatterns.push(`${eslintRootDir}/**/*`);
    }
  }

  const projectFiles = await globWithWorkspaceContext(
    context.workspaceRoot,
    ['project.json', 'package.json', '**/project.json', '**/package.json'].map(
      (f) => join(configDir, f)
    ),
    nestedEslintRootPatterns.length ? nestedEslintRootPatterns : undefined
  );
  // dedupe and sort project roots by depth for more efficient traversal
  const dedupedProjectRoots = Array.from(
    new Set(projectFiles.map((f) => dirname(f)))
  ).sort((a, b) => (a !== b && isSubDir(a, b) ? -1 : 1));
  const excludePatterns = dedupedProjectRoots.map((root) => `${root}/**/*`);

  const ESLint = await resolveESLintClass(isFlatConfig(configFilePath));
  const eslintVersion = ESLint.version;

  const projects: CreateNodesResult['projects'] = {};
  await Promise.all(
    dedupedProjectRoots.map(async (childProjectRoot, index) => {
      // anything after is either a nested project or a sibling project, can be excluded
      const nestedProjectRootPatterns = excludePatterns.slice(index + 1);

      // Ignore project roots where the project does not contain any lintable files
      const lintableFiles = await globWithWorkspaceContext(
        context.workspaceRoot,
        [join(childProjectRoot, `**/*.{${options.extensions.join(',')}}`)],
        // exclude nested eslint roots and nested project roots
        [...nestedEslintRootPatterns, ...nestedProjectRootPatterns]
      );

      const parentConfigs = context.configFiles.filter((eslintConfig) =>
        isSubDir(childProjectRoot, dirname(eslintConfig))
      );
      const hash = await calculateHashForCreateNodes(
        childProjectRoot,
        options,
        context,
        [...parentConfigs, join(childProjectRoot, '.eslintignore')]
      );

      if (projectsCache[hash]) {
        // We can reuse the projects in the cache.
        Object.assign(projects, projectsCache[hash]);
        return;
      }
      const eslint = new ESLint({
        cwd: join(context.workspaceRoot, childProjectRoot),
      });
      let hasNonIgnoredLintableFiles = false;
      for (const file of lintableFiles) {
        if (!(await eslint.isPathIgnored(join(context.workspaceRoot, file)))) {
          hasNonIgnoredLintableFiles = true;
          break;
        }
      }

      if (!hasNonIgnoredLintableFiles) {
        // No lintable files in the project, store in the cache and skip further processing
        projectsCache[hash] = {};
        return;
      }

      const project = getProjectUsingESLintConfig(
        configFilePath,
        childProjectRoot,
        eslintVersion,
        options,
        context
      );

      if (project) {
        projects[childProjectRoot] = project;
        // Store project into the cache
        projectsCache[hash] = { [childProjectRoot]: project };
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

let collectingLintableFilesPromise: Promise<void>;
const internalCreateNodesV2 = async (
  configFilePath: string,
  options: EslintPluginOptions,
  context: CreateNodesContextV2,
  eslintConfigFiles: string[],
  allProjectRoots: string[],
  projectRootsByEslintRoots: Map<string, string[]>,
  lintableFilesPerProjectRoot: Map<string, string[]>,
  projectsCache: Record<string, CreateNodesResult['projects']>
): Promise<CreateNodesResult> => {
  const configDir = dirname(configFilePath);

  const ESLint = await resolveESLintClass(isFlatConfig(configFilePath));
  const eslintVersion = ESLint.version;

  const projects: CreateNodesResult['projects'] = {};
  await Promise.all(
    projectRootsByEslintRoots.get(configDir).map(async (projectRoot) => {
      const parentConfigs = eslintConfigFiles.filter((eslintConfig) =>
        isSubDir(projectRoot, dirname(eslintConfig))
      );
      const hash = await calculateHashForCreateNodes(
        projectRoot,
        options,
        {
          configFiles: eslintConfigFiles,
          nxJsonConfiguration: context.nxJsonConfiguration,
          workspaceRoot: context.workspaceRoot,
        },
        [...parentConfigs, join(projectRoot, '.eslintignore')]
      );

      if (projectsCache[hash]) {
        // We can reuse the projects in the cache.
        Object.assign(projects, projectsCache[hash]);
        return;
      }

      if (!lintableFilesPerProjectRoot.size) {
        collectingLintableFilesPromise ??= collectLintableFilesByProjectRoot(
          lintableFilesPerProjectRoot,
          allProjectRoots,
          options,
          context
        );
        await collectingLintableFilesPromise;
        collectingLintableFilesPromise = null;
      }

      const eslint = new ESLint({
        cwd: join(context.workspaceRoot, projectRoot),
      });
      let hasNonIgnoredLintableFiles = false;
      for (const file of lintableFilesPerProjectRoot.get(projectRoot) ?? []) {
        if (!(await eslint.isPathIgnored(join(context.workspaceRoot, file)))) {
          hasNonIgnoredLintableFiles = true;
          break;
        }
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
        context
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

export const createNodesV2: CreateNodesV2<EslintPluginOptions> = [
  ESLINT_CONFIG_GLOB_V2,
  async (configFiles, options, context) => {
    options = normalizeOptions(options);
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `eslint-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    const { eslintConfigFiles, projectRoots, projectRootsByEslintRoots } =
      splitConfigFiles(configFiles);
    const lintableFilesPerProjectRoot = new Map<string, string[]>();

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          internalCreateNodesV2(
            configFile,
            options,
            context,
            eslintConfigFiles,
            projectRoots,
            projectRootsByEslintRoots,
            lintableFilesPerProjectRoot,
            targetsCache
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

export const createNodes: CreateNodes<EslintPluginOptions> = [
  ESLINT_CONFIG_GLOB_V1,
  (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    return internalCreateNodes(configFilePath, options, context, {});
  },
];

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

async function collectLintableFilesByProjectRoot(
  lintableFilesPerProjectRoot: Map<string, string[]>,
  projectRoots: string[],
  options: EslintPluginOptions,
  context: CreateNodesContext | CreateNodesContextV2
): Promise<void> {
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
  context: CreateNodesContext | CreateNodesContextV2
): CreateNodesResult['projects'][string] | null {
  const rootEslintConfig = [
    baseEsLintConfigFile,
    baseEsLintFlatConfigFile,
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
      standaloneSrcPath
    ),
  };
}

function buildEslintTargets(
  eslintConfigs: string[],
  eslintVersion: string,
  projectRoot: string,
  workspaceRoot: string,
  options: EslintPluginOptions,
  standaloneSrcPath?: string
) {
  const pmc = getPackageManagerCommand();
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
      ...eslintConfigs.map((config) =>
        `{workspaceRoot}/${config}`.replace(
          `{workspaceRoot}/${projectRoot}`,
          isRootProject ? '{projectRoot}/' : '{projectRoot}'
        )
      ),
      ...(existsSync(join(workspaceRoot, projectRoot, '.eslintignore'))
        ? ['{projectRoot}/.eslintignore']
        : []),
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
    targetName: options.targetName ?? 'lint',
  };

  // Normalize user input for extensions (strip leading . characters)
  if (Array.isArray(options.extensions)) {
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
