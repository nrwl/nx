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
import { ESLINT_CONFIG_FILENAMES } from '../generators/utils/eslint-file';

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

    return {
      projects: {
        [projectName]: {
          root: projectRoot,
          targets: buildEslintTargets(
            configFilePath,
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
  configFilePath: string,
  projectRoot: string,
  options: EslintPluginOptions,
  context: CreateNodesContext
) {
  const targetDefaults = readTargetDefaultsForTarget(
    options.targetName,
    context.nxJsonConfiguration.targetDefaults,
    '@nx/eslint:lint'
  );

  const targets: Record<string, TargetConfiguration<Schema>> = {};

  const baseTargetConfig: TargetConfiguration<Schema> = {
    executor: '@nx/eslint:lint',
    options: {
      config: configFilePath,
      lintFilePatterns: [projectRoot],
      ...targetDefaults?.options,
    },
  };

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: targetDefaults?.cache ?? true,
    inputs: targetDefaults?.inputs ?? [
      'default',
      '{workspaceRoot}/.eslintrc.json', // TODO: detect which eslint config file is the base one
      '{workspaceRoot}/tools/eslint-rules/**/*'
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
