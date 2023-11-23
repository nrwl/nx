import {
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { basename, dirname, join } from 'path';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { readdirSync } from 'fs';
import type { Schema } from '../executors/lint/schema';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import {
  ESLINT_CONFIG_FILENAMES,
  findBaseEslintFile,
  isFlatConfig,
} from '../utils/config-file';

export interface EslintPluginOptions {
  targetName?: string;
}

export const createNodes: CreateNodes<EslintPluginOptions> = [
  combineGlobPatterns(ESLINT_CONFIG_FILENAMES.map((file) => `**/${file}`)),
  (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options = normalizeOptions(options);
    const projectName = basename(projectRoot);

    const rootEslintConfigFile = findBaseEslintFile(context.workspaceRoot);

    return {
      projects: {
        [projectName]: {
          root: projectRoot,
          targets: buildEslintTargets(
            rootEslintConfigFile,
            projectRoot,
            options,
            context
          ),
        },
      },
    };
  },
];

function buildEslintTargets(
  rootEslintConfigFile: string,
  projectRoot: string,
  options: EslintPluginOptions,
  context: CreateNodesContext
) {
  const targetDefaults = readTargetDefaultsForTarget(
    options.targetName,
    context.nxJsonConfiguration.targetDefaults,
    '@nx/eslint:lint'
  );

  const isRootProject = projectRoot === '.';

  const targets: Record<string, TargetConfiguration> = {};

  const command = isFlatConfig(rootEslintConfigFile)
    ? `ESLINT_USE_FLAT_CONFIG=true eslint`
    : `eslint`;

  const baseTargetConfig: TargetConfiguration = {
    command: `${command} ${isRootProject ? './src' : '.'}`,
    options: {
      cwd: projectRoot,
    },
  };

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: targetDefaults?.cache ?? true,
    inputs: targetDefaults?.inputs ?? [
      'default',
      `{workspaceRoot}/${rootEslintConfigFile}`,
      '{workspaceRoot}/tools/eslint-rules/**/*',
    ],
    outputs: targetDefaults?.outputs ?? ['{options.outputFile}'],
    options: {
      ...baseTargetConfig.options,
    },
  };

  return targets;
}

function normalizeOptions(options: EslintPluginOptions): EslintPluginOptions {
  options ??= {};
  options.targetName ??= 'lint';
  return options;
}
