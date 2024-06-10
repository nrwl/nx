import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
  detectPackageManager,
  joinPathFragments,
  parseJson,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import type { StorybookConfig } from '@storybook/types';

export interface StorybookPluginOptions {
  buildStorybookTargetName?: string;
  serveStorybookTargetName?: string;
  staticStorybookTargetName?: string;
  testStorybookTargetName?: string;
}

const cachePath = join(workspaceDataDirectory, 'storybook.hash');
const targetsCache = readTargetsCache();

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
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

export const createNodes: CreateNodes<StorybookPluginOptions> = [
  '**/.storybook/main.{js,ts,mjs,mts,cjs,cts}',
  async (configFilePath, options, context) => {
    let projectRoot = '';
    if (configFilePath.includes('/.storybook')) {
      projectRoot = dirname(configFilePath).replace('/.storybook', '');
    } else {
      projectRoot = dirname(configFilePath).replace('.storybook', '');
    }

    if (projectRoot === '') {
      projectRoot = '.';
    }

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options = normalizeOptions(options);
    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options,
      context,
      [getLockFileName(detectPackageManager(context.workspaceRoot))]
    );

    const projectName = buildProjectName(projectRoot, context.workspaceRoot);

    targetsCache[hash] ??= await buildStorybookTargets(
      configFilePath,
      projectRoot,
      options,
      context,
      projectName
    );

    const result = {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets: targetsCache[hash],
        },
      },
    };

    return result;
  },
];

async function buildStorybookTargets(
  configFilePath: string,
  projectRoot: string,
  options: StorybookPluginOptions,
  context: CreateNodesContext,
  projectName: string
) {
  const buildOutputs = getOutputs(projectRoot);

  const namedInputs = getNamedInputs(projectRoot, context);

  const storybookFramework = await getStorybookFramework(
    configFilePath,
    context
  );

  const frameworkIsAngular = storybookFramework === '@storybook/angular';

  if (frameworkIsAngular && !projectName) {
    throw new Error(
      `Could not find a name for the project at '${projectRoot}'. Please make sure that the project has a package.json or project.json file with name specified.`
    );
  }

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildStorybookTargetName] = buildTarget(
    namedInputs,
    buildOutputs,
    projectRoot,
    frameworkIsAngular,
    projectName,
    configFilePath
  );

  targets[options.serveStorybookTargetName] = serveTarget(
    projectRoot,
    frameworkIsAngular,
    projectName,
    configFilePath
  );

  if (isStorybookTestRunnerInstalled()) {
    targets[options.testStorybookTargetName] = testTarget(projectRoot);
  }

  targets[options.staticStorybookTargetName] = serveStaticTarget(
    options,
    projectRoot
  );

  return targets;
}

function buildTarget(
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string,
  frameworkIsAngular: boolean,
  projectName: string,
  configFilePath: string
) {
  let targetConfig: TargetConfiguration;

  if (frameworkIsAngular) {
    targetConfig = {
      executor: '@storybook/angular:build-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget: `${projectName}:build-storybook`,
        compodoc: false,
        outputDir: joinPathFragments(projectRoot, 'storybook-static'),
      },
      cache: true,
      outputs,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: [
            'storybook',
            '@storybook/angular',
            '@storybook/test-runner',
          ],
        },
      ],
    };
  } else {
    targetConfig = {
      command: `storybook build`,
      options: { cwd: projectRoot },
      cache: true,
      outputs,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: ['storybook', '@storybook/test-runner'],
        },
      ],
    };
  }

  return targetConfig;
}

function serveTarget(
  projectRoot: string,
  frameworkIsAngular: boolean,
  projectName: string,
  configFilePath: string
) {
  if (frameworkIsAngular) {
    return {
      executor: '@storybook/angular:start-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget: `${projectName}:build-storybook`,
        compodoc: false,
      },
    };
  } else {
    return {
      command: `storybook dev`,
      options: { cwd: projectRoot },
    };
  }
}

function testTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `test-storybook`,
    options: { cwd: projectRoot },
    inputs: [
      {
        externalDependencies: ['storybook', '@storybook/test-runner'],
      },
    ],
  };

  return targetConfig;
}

function serveStaticTarget(
  options: StorybookPluginOptions,
  projectRoot: string
) {
  const targetConfig: TargetConfiguration = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildStorybookTargetName}`,
      staticFilePath: joinPathFragments(projectRoot, 'storybook-static'),
    },
  };

  return targetConfig;
}

async function getStorybookFramework(
  configFilePath: string,
  context: CreateNodesContext
): Promise<string> {
  const resolvedPath = join(context.workspaceRoot, configFilePath);
  const { framework } = await loadConfigFile<StorybookConfig>(resolvedPath);

  return typeof framework === 'string' ? framework : framework.name;
}

function getOutputs(projectRoot: string): string[] {
  const normalizedOutputPath = normalizeOutputPath(projectRoot);

  const outputs = [
    normalizedOutputPath,
    `{options.output-dir}`,
    `{options.outputDir}`,
    `{options.o}`,
  ];

  return outputs;
}

function normalizeOutputPath(projectRoot: string): string | undefined {
  if (projectRoot === '.') {
    return `{projectRoot}/storybook-static`;
  } else {
    return `{workspaceRoot}/{projectRoot}/storybook-static`;
  }
}

function normalizeOptions(
  options: StorybookPluginOptions
): StorybookPluginOptions {
  options ??= {};
  options.buildStorybookTargetName ??= 'build-storybook';
  options.serveStorybookTargetName ??= 'storybook';
  options.testStorybookTargetName ??= 'test-storybook';
  options.staticStorybookTargetName ??= 'static-storybook';
  return options;
}

function buildProjectName(
  projectRoot: string,
  workspaceRoot: string
): string | undefined {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  let name: string;
  if (existsSync(projectJsonPath)) {
    const projectJson = parseJson(readFileSync(projectJsonPath, 'utf-8'));
    name = projectJson.name;
  } else if (existsSync(packageJsonPath)) {
    const packageJson = parseJson(readFileSync(packageJsonPath, 'utf-8'));
    name = packageJson.name;
  }
  return name;
}

function isStorybookTestRunnerInstalled(): boolean {
  try {
    require.resolve('@storybook/test-runner');
    return true;
  } catch (e) {
    return false;
  }
}
