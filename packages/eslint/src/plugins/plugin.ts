import {
  CreateNodes,
  CreateNodesContext,
  CreateNodesResult,
  CreateNodesV2,
  TargetConfiguration,
  createNodesFromFiles,
  logger,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import {
  globWithWorkspaceContext,
  hashWithWorkspaceContext,
} from 'nx/src/utils/workspace-context';
import {
  ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
  baseEsLintFlatConfigFile,
  isFlatConfig,
} from '../utils/config-file';
import { resolveESLintClass } from '../utils/resolve-eslint-class';
import { gte } from 'semver';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';

export interface EslintPluginOptions {
  targetName?: string;
  extensions?: string[];
}

const DEFAULT_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'html', 'vue'];
const ESLING_CONFIG_GLOB = combineGlobPatterns([
  ...ESLINT_CONFIG_FILENAMES.map((f) => `**/${f}`),
  baseEsLintConfigFile,
  baseEsLintFlatConfigFile,
]);

type EslintProjects = Awaited<ReturnType<typeof getProjectsUsingESLintConfig>>;

function readTargetsCache(cachePath: string): Record<string, EslintProjects> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, EslintProjects>
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
  const eslintRoots = new Set();
  const nestedEslintRootPatterns: string[] = [];
  for (const configFile of context.configFiles) {
    const eslintRootDir = dirname(configFile);
    eslintRoots.add(eslintRootDir);

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
  const childProjectRoots = new Set<string>();

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
      for (const file of lintableFiles) {
        if (!(await eslint.isPathIgnored(join(context.workspaceRoot, file)))) {
          childProjectRoots.add(childProjectRoot);
          break;
        }
      }

      const uniqueChildProjectRoots = Array.from(childProjectRoots);

      const projectsForRoot = getProjectsUsingESLintConfig(
        configFilePath,
        uniqueChildProjectRoots,
        eslintVersion,
        options,
        context
      );

      if (Object.keys(projectsForRoot).length > 0) {
        Object.assign(projects, projectsForRoot);
        // Store those projects into the cache;
        projectsCache[hash] = projectsForRoot;
      }
    })
  );

  return {
    projects,
  };
};

export const createNodesV2: CreateNodesV2<EslintPluginOptions> = [
  ESLING_CONFIG_GLOB,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      projectGraphCacheDirectory,
      `eslint-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          internalCreateNodes(configFile, options, context, targetsCache),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodes: CreateNodes<EslintPluginOptions> = [
  ESLING_CONFIG_GLOB,
  (configFilePath, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    return internalCreateNodes(configFilePath, options, context, {});
  },
];

function getProjectsUsingESLintConfig(
  configFilePath: string,
  childProjectRoots: string[],
  eslintVersion: string,
  options: EslintPluginOptions,
  context: CreateNodesContext
): CreateNodesResult['projects'] {
  const projects: CreateNodesResult['projects'] = {};

  const rootEslintConfig = [
    baseEsLintConfigFile,
    baseEsLintFlatConfigFile,
    ...ESLINT_CONFIG_FILENAMES,
  ].find((f) => existsSync(join(context.workspaceRoot, f)));

  // Add a lint target for each child project without an eslint config, with the root level config as an input
  for (const projectRoot of childProjectRoots) {
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
      continue;
    }

    const eslintConfigs = [configFilePath];

    if (rootEslintConfig && !eslintConfigs.includes(rootEslintConfig)) {
      eslintConfigs.unshift(rootEslintConfig);
    }

    projects[projectRoot] = {
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

  return projects;
}

function buildEslintTargets(
  eslintConfigs: string[],
  eslintVersion: string,
  projectRoot: string,
  workspaceRoot: string,
  options: EslintPluginOptions,
  standaloneSrcPath?: string
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
  options ??= {};
  options.targetName ??= 'lint';

  // Normalize user input for extensions (strip leading . characters)
  if (Array.isArray(options.extensions)) {
    options.extensions = options.extensions.map((f) => f.replace(/^\.+/, ''));
  } else {
    options.extensions = DEFAULT_EXTENSIONS;
  }

  return options;
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
