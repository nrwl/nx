import {
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  joinPathFragments,
  normalizePath,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
} from '@nx/devkit';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export interface NestPluginOptions {
  buildTargetName?: string;
  serveTargetName?: string;
}

type NestCliConfig = {
  compilerOptions?: {
    outputPath?: string;
  };
};

const nestCliConfigGlob = '**/nest-cli.json';

export const createNodes: CreateNodesV2<NestPluginOptions> = [
  nestCliConfigGlob,
  async (configFilePaths, options, context) => {
    const normalizedOptions = normalizeOptions(options);
    const validConfigFiles = configFilePaths.filter((configFilePath) =>
      checkIfConfigFileShouldBeProject(
        normalizeProjectRoot(dirname(configFilePath)),
        context
      )
    );

    return createNodesFromFiles(
      async (configFilePath) => {
        const projectRoot = normalizeProjectRoot(dirname(configFilePath));
        const nestCliConfig = readNestCliConfig(configFilePath, context);

        return {
          projects: {
            [projectRoot]: {
              root: projectRoot,
              targets: buildNestTargets(
                projectRoot,
                nestCliConfig,
                normalizedOptions,
                context
              ),
              metadata: {
                technologies: ['nest'],
              },
            },
          },
        };
      },
      validConfigFiles,
      normalizedOptions,
      context
    );
  },
];

export const createNodesV2 = createNodes;

function buildNestTargets(
  projectRoot: string,
  nestCliConfig: NestCliConfig,
  options: NestPluginOptions,
  context: CreateNodesContextV2
): Record<string, TargetConfiguration> {
  const namedInputs = getNamedInputs(context);
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
    [options.serveTargetName]: {
      command: 'nest start --watch',
      options: {
        cwd: projectRoot,
      },
      continuous: true,
      metadata: {
        technologies: ['nest'],
        description: 'Run the Nest project in watch mode.',
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
  ];
}

function normalizeProjectRoot(projectRoot: string): string {
  return normalizePath(projectRoot);
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
    return `{workspaceRoot}/${relative(
      workspaceRoot,
      resolve(workspaceRoot, outputPath)
    )}`;
  }

  if (outputPath.startsWith('..')) {
    return joinPathFragments('{workspaceRoot}', projectRoot, outputPath);
  }

  return joinPathFragments('{projectRoot}', outputPath);
}

function normalizeOptions(options: NestPluginOptions): NestPluginOptions {
  options ??= {};
  options.buildTargetName ??= 'build';
  options.serveTargetName ??= 'serve';
  return options;
}

function getNamedInputs(
  context: CreateNodesContextV2
): NxJsonConfiguration['namedInputs'] {
  return context.nxJsonConfiguration?.namedInputs ?? {};
}

function readNestCliConfig(
  configFilePath: string,
  context: CreateNodesContextV2
): NestCliConfig {
  return readJsonFile(join(context.workspaceRoot, configFilePath));
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContextV2
): boolean {
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
