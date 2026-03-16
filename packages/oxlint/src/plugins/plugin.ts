import {
  createNodesFromFiles,
  CreateNodesContextV2,
  CreateNodesResult,
  CreateNodesV2,
  getPackageManagerCommand,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { basename, dirname, join, normalize, sep } from 'node:path/posix';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { OXLINT_CONFIG_FILENAMES } from '../utils/config-file';

const pmc = getPackageManagerCommand();
const PROJECT_CONFIG_FILENAMES = ['project.json', 'package.json'];
const TARGETS_CACHE_VERSION = 2;
const OXLINT_CONFIG_GLOB_V2 = combineGlobPatterns([
  ...OXLINT_CONFIG_FILENAMES.map((f) => `**/${f}`),
  ...PROJECT_CONFIG_FILENAMES.map((f) => `**/${f}`),
]);

export interface OxlintPluginOptions {
  targetName?: string;
}

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

export const createNodes: CreateNodesV2<OxlintPluginOptions> = [
  OXLINT_CONFIG_GLOB_V2,
  async (configFiles, options, context) => {
    options = normalizeOptions(options);
    const optionsHash = hashObject({
      ...options,
      __cacheVersion: TARGETS_CACHE_VERSION,
    });
    const cachePath = join(
      workspaceDataDirectory,
      `oxlint-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    try {
      const { oxlintConfigFiles, projectRoots } = splitConfigFiles(configFiles);
      if (oxlintConfigFiles.length === 0 || projectRoots.length === 0) {
        return [];
      }

      const projectRootsByConfig = groupProjectRootsByConfig(
        oxlintConfigFiles,
        projectRoots
      );

      return await createNodesFromFiles(
        async (configFilePath, options, context) => {
          const projects: CreateNodesResult['projects'] = {};
          const projectRoots = projectRootsByConfig.get(configFilePath) ?? [];

          for (const projectRoot of projectRoots) {
            const hash = `${projectRoot}:${configFilePath}:${optionsHash}`;
            if (targetsCache[hash]) {
              Object.assign(projects, targetsCache[hash]);
              continue;
            }

            const project = getProjectUsingOxlintConfig(
              projectRoot,
              oxlintConfigFiles.filter((config) =>
                isSubDir(dirname(config), projectRoot)
              ),
              options,
              context
            );

            if (project) {
              projects[projectRoot] = project;
              targetsCache[hash] = { [projectRoot]: project };
            } else {
              targetsCache[hash] = {};
            }
          }

          return { projects };
        },
        oxlintConfigFiles,
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
  oxlintConfigFiles: string[];
  projectRoots: string[];
} {
  const oxlintConfigFiles: string[] = [];
  const projectRoots = new Set<string>();

  for (const configFile of configFiles) {
    if (PROJECT_CONFIG_FILENAMES.includes(basename(configFile))) {
      projectRoots.add(dirname(configFile));
    } else {
      oxlintConfigFiles.push(configFile);
    }
  }

  return {
    oxlintConfigFiles,
    projectRoots: Array.from(projectRoots),
  };
}

function groupProjectRootsByConfig(
  oxlintConfigFiles: string[],
  projectRoots: string[]
): Map<string, string[]> {
  const byConfig = new Map<string, string[]>();

  for (const configFile of oxlintConfigFiles) {
    byConfig.set(configFile, []);
  }

  for (const projectRoot of projectRoots) {
    const nearest = getNearestConfigForProject(projectRoot, oxlintConfigFiles);
    if (nearest) {
      byConfig.get(nearest).push(projectRoot);
    }
  }

  return byConfig;
}

function getNearestConfigForProject(
  projectRoot: string,
  configFiles: string[]
): string | undefined {
  const matchingConfigs = configFiles.filter((config) =>
    isSubDir(dirname(config), projectRoot)
  );
  if (matchingConfigs.length === 0) {
    return undefined;
  }
  return matchingConfigs.sort(
    (a, b) => dirname(b).length - dirname(a).length
  )[0];
}

function getProjectUsingOxlintConfig(
  projectRoot: string,
  oxlintConfigs: string[],
  options: OxlintPluginOptions,
  context: CreateNodesContextV2
): CreateNodesResult['projects'][string] | null {
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

  const sortedConfigs = [...oxlintConfigs].sort(
    (a, b) => dirname(a).length - dirname(b).length
  );

  return {
    targets: buildOxlintTargets(
      sortedConfigs,
      projectRoot,
      options,
      standaloneSrcPath
    ),
  };
}

function buildOxlintTargets(
  oxlintConfigs: string[],
  projectRoot: string,
  options: OxlintPluginOptions,
  standaloneSrcPath?: string
): Record<string, TargetConfiguration> {
  const isRootProject = projectRoot === '.';
  const lintPath =
    isRootProject && standaloneSrcPath
      ? `./${standaloneSrcPath}`
      : isRootProject
        ? '.'
        : projectRoot;
  const targetConfig: TargetConfiguration = {
    command: `oxlint ${lintPath}`,
    cache: true,
    inputs: [
      'default',
      '^default',
      ...oxlintConfigs.map((config) => `{workspaceRoot}/${config}`),
      { externalDependencies: ['oxlint'] },
    ],
    metadata: {
      technologies: ['oxlint'],
      description: 'Runs OXLint on project',
      help: {
        command: `${pmc.exec} oxlint --help`,
        example: {
          options: {
            'max-warnings': 0,
          },
        },
      },
    },
  };

  return {
    [options.targetName]: targetConfig,
  };
}

function normalizeOptions(options: OxlintPluginOptions): OxlintPluginOptions {
  return {
    targetName: options?.targetName ?? 'oxlint',
  };
}

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
