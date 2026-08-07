import {
  createNodesFromFiles,
  joinPathFragments,
  normalizePath,
  readJsonFile,
  detectPackageManager,
  type CreateNodes,
  type CreateNodesContext,
  type NxJsonConfiguration,
  type TargetConfiguration,
} from '@nx/devkit';
import {
  calculateHashesForCreateNodes,
  getNamedInputs,
  PluginCache,
} from '@nx/devkit/internal';
import { getLockFileName } from '@nx/js';
import { TS_SOLUTION_SETUP_TSCONFIG_INPUT } from '@nx/js/internal';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { hashObject } from 'nx/src/devkit-internals';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';

export interface NestPluginOptions {
  buildTargetName?: string;
  startTargetName?: string;
  /**
   * @deprecated Use `startTargetName` instead.
   */
  serveTargetName?: string;
}

type NestCliConfig = {
  compilerOptions?: {
    outputPath?: string;
  };
};

const nestCliConfigGlob = '**/nest-cli.json';

type NestTargets = Record<string, TargetConfiguration<NestPluginOptions>>;

export const createNodes: CreateNodes<NestPluginOptions> = [
  nestCliConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `nest-${optionsHash}.hash`);
    const targetsCache = new PluginCache<NestTargets>(cachePath);
    const normalizedOptions = normalizeOptions(options);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const lockFileName = getLockFileName(packageManager);
    const validConfigFiles = configFilePaths.filter((configFilePath) =>
      checkIfConfigFileShouldBeProject(configFilePath, context)
    );
    const projectRoots = validConfigFiles.map(getProjectRootFromConfigFilePath);

    try {
      const projectHashes = await calculateHashesForCreateNodes(
        projectRoots,
        normalizedOptions,
        context,
        projectRoots.map(() => [lockFileName])
      );

      return await createNodesFromFiles(
        (configFilePath, _, ctx, idx) =>
          createNodesInternal(
            configFilePath,
            normalizedOptions,
            ctx,
            targetsCache,
            projectHashes[idx]
          ),
        validConfigFiles,
        options,
        context
      );
    } finally {
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

function createNodesInternal(
  configFilePath: string,
  options: NestPluginOptions,
  context: CreateNodesContext,
  targetsCache: PluginCache<NestTargets>,
  hash: string
) {
  const projectRoot = getProjectRootFromConfigFilePath(configFilePath);
  const hashKey = `${hash}:${configFilePath}`;

  if (!targetsCache.has(hashKey)) {
    const nestCliConfig = readNestCliConfig(configFilePath, context);
    targetsCache.set(
      hashKey,
      buildNestTargets(projectRoot, nestCliConfig, options, context)
    );
  }

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: targetsCache.get(hashKey),
        metadata: {
          technologies: ['nest'],
        },
      },
    },
  };
}

function buildNestTargets(
  projectRoot: string,
  nestCliConfig: NestCliConfig,
  options: NestPluginOptions,
  context: CreateNodesContext
): Record<string, TargetConfiguration> {
  const namedInputs = getNamedInputs(projectRoot, context);
  const buildOutputs = normalizeOutputPath(
    nestCliConfig.compilerOptions?.outputPath,
    projectRoot,
    context.workspaceRoot
  );

  return {
    [options.buildTargetName]: {
      command: 'nest build',
      options: {
        cwd: projectRoot,
      },
      cache: true,
      dependsOn: [`^${options.buildTargetName}`],
      inputs: getBuildInputs(namedInputs),
      outputs: buildOutputs ? [buildOutputs] : [],
      metadata: {
        technologies: ['nest'],
        description: 'Build the Nest project.',
      },
    },
    [options.startTargetName]: {
      command: 'nest start',
      options: {
        cwd: projectRoot,
      },
      continuous: true,
      metadata: {
        technologies: ['nest'],
        description: 'Run the Nest project.',
      },
    },
  };
}

function getBuildInputs(
  namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['production', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['@nestjs/cli'],
    },
    TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  ];
}

function getProjectRootFromConfigFilePath(configFilePath: string): string {
  return normalizePath(dirname(configFilePath));
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string,
  workspaceRoot: string
): string {
  if (!outputPath) {
    return joinPathFragments('{projectRoot}', 'dist');
  }

  if (isAbsolute(outputPath)) {
    return joinPathFragments(
      '{workspaceRoot}',
      relative(workspaceRoot, resolve(workspaceRoot, outputPath))
    );
  }

  if (outputPath.startsWith('..')) {
    return joinPathFragments('{workspaceRoot}', projectRoot, outputPath);
  }

  return joinPathFragments('{projectRoot}', outputPath);
}

function normalizeOptions(options: NestPluginOptions): NestPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.startTargetName ??= options.serveTargetName ?? 'start';
  return options;
}

function readNestCliConfig(
  configFilePath: string,
  context: CreateNodesContext
): NestCliConfig {
  return readJsonFile(join(context.workspaceRoot, configFilePath));
}

function checkIfConfigFileShouldBeProject(
  configFilePath: string,
  context: CreateNodesContext
) {
  const projectRoot = getProjectRootFromConfigFilePath(configFilePath);
  const absoluteProjectRoot = join(context.workspaceRoot, projectRoot);

  if (!existsSync(absoluteProjectRoot)) {
    return false;
  }

  const siblingFiles = readdirSync(absoluteProjectRoot);

  return (
    siblingFiles.includes('package.json') ||
    siblingFiles.includes('project.json')
  );
}
