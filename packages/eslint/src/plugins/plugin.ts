import {
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { basename, dirname, join } from 'path';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { readdirSync } from 'fs';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import {
  ESLINT_CONFIG_FILENAMES,
  findBaseEslintFile,
  isFlatConfig,
} from '../utils/config-file';

export interface EslintPluginOptions {
  targetName?: string;
  excludedProjects?: string[];
}

export const createNodes: CreateNodes<EslintPluginOptions> = [
  combineGlobPatterns(['**/project.json', '**/package.json']),
  (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);

    if (!projectHasEslintConfig(projectRoot, context.workspaceRoot)) {
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

function projectHasEslintConfig(
  projectRoot: string,
  workspaceRoot: string
): boolean {
  const siblingFiles = readdirSync(join(workspaceRoot, projectRoot));

  if (projectRoot === '.') {
    // If there's no src folder, it's not a standalone project
    if (!siblingFiles.includes('src')) {
      return false;
    }
    // If it's standalone but doesn't have eslint config, it's not a lintable
    if (!siblingFiles.some((f) => ESLINT_CONFIG_FILENAMES.includes(f))) {
      return false;
    }
    return true;
  }
  // if it has an eslint config it's lintable
  if (siblingFiles.some((f) => ESLINT_CONFIG_FILENAMES.includes(f))) {
    return true;
  }
  // check whether the root has an eslint config
  return readdirSync(workspaceRoot).some((f) =>
    ESLINT_CONFIG_FILENAMES.includes(f)
  );
}

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

  const baseTargetConfig: TargetConfiguration = {
    command: `eslint ${isRootProject ? './src' : '.'}`,
    options: {
      cwd: projectRoot,
    },
  };
  if (isFlatConfig(rootEslintConfigFile)) {
    baseTargetConfig.options.env = {
      ESLINT_USE_FLAT_CONFIG: 'true',
    };
  }

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: targetDefaults?.cache ?? true,
    inputs: targetDefaults?.inputs ?? [
      'default',
      `{workspaceRoot}/${rootEslintConfigFile}`,
      '{workspaceRoot}/tools/eslint-rules/**/*',
      { externalDependencies: ['eslint'] },
    ],
    options: {
      ...baseTargetConfig.options,
    },
  };

  return targets;
}

function normalizeOptions(options: EslintPluginOptions): EslintPluginOptions {
  options ??= {};
  options.targetName ??= 'lint';
  options.excludedProjects ??= [];
  return options;
}
