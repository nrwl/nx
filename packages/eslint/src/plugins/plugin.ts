import {
  CreateNodes,
  CreateNodesContext,
  CreateNodesResult,
  TargetConfiguration,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import {
  ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
  baseEsLintFlatConfigFile,
  isFlatConfig,
} from '../utils/config-file';

export interface EslintPluginOptions {
  targetName?: string;
  extensions?: string[];
}

const DEFAULT_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'html', 'vue'];

export const createNodes: CreateNodes<EslintPluginOptions> = [
  combineGlobPatterns([
    ...ESLINT_CONFIG_FILENAMES.map((f) => `**/${f}`),
    baseEsLintConfigFile,
    baseEsLintFlatConfigFile,
  ]),
  (configFilePath, options, context) => {
    options = normalizeOptions(options);

    // Ensure that configFiles are set, e2e-run fails due to them being undefined in CI (does not occur locally)
    // TODO(JamesHenry): Further troubleshoot this in CI
    (context as any).configFiles = context.configFiles ?? [];

    // Create a Set of all the directories containing eslint configs
    const eslintRoots = new Set(context.configFiles.map(dirname));
    const configDir = dirname(configFilePath);

    const childProjectRoots = globWithWorkspaceContext(
      context.workspaceRoot,
      [
        'project.json',
        'package.json',
        '**/project.json',
        '**/package.json',
      ].map((f) => join(configDir, f))
    )
      .map((f) => dirname(f))
      .filter((childProjectRoot) => {
        // Filter out projects under other eslint configs
        let root = childProjectRoot;
        // Traverse up from the childProjectRoot to either the workspaceRoot or the dir of this config file
        while (root !== dirname(root) && root !== dirname(configFilePath)) {
          if (eslintRoots.has(root)) {
            return false;
          }
          root = dirname(root);
        }
        return true;
      })
      .filter((dir) => {
        // Ignore project roots where the project does not contain any lintable files
        const lintableFiles = globWithWorkspaceContext(context.workspaceRoot, [
          join(dir, `**/*.{${options.extensions.join(',')}}`),
        ]);
        return lintableFiles.length > 0;
      });

    const uniqueChildProjectRoots = Array.from(new Set(childProjectRoots));

    return {
      projects: getProjectsUsingESLintConfig(
        configFilePath,
        uniqueChildProjectRoots,
        options,
        context
      ),
    };
  },
];

function getProjectsUsingESLintConfig(
  configFilePath: string,
  childProjectRoots: string[],
  options: EslintPluginOptions,
  context: CreateNodesContext
): CreateNodesResult['projects'] {
  const projects: CreateNodesResult['projects'] = {};

  const rootEslintConfig = context.configFiles.find(
    (f) =>
      f === baseEsLintConfigFile ||
      f === baseEsLintFlatConfigFile ||
      ESLINT_CONFIG_FILENAMES.includes(f)
  );

  // Add a lint target for each child project without an eslint config, with the root level config as an input
  for (const projectRoot of childProjectRoots) {
    // If there's no src folder, it's not a standalone project, do not add the target at all
    const isStandaloneWorkspace =
      projectRoot === '.' &&
      existsSync(join(context.workspaceRoot, projectRoot, 'src')) &&
      existsSync(join(context.workspaceRoot, projectRoot, 'package.json'));
    if (projectRoot === '.' && !isStandaloneWorkspace) {
      continue;
    }

    const eslintConfigs = [configFilePath];

    if (rootEslintConfig && !eslintConfigs.includes(rootEslintConfig)) {
      eslintConfigs.unshift(rootEslintConfig);
    }

    projects[projectRoot] = {
      targets: buildEslintTargets(
        eslintConfigs,
        projectRoot,
        options,
        isStandaloneWorkspace
      ),
    };
  }

  return projects;
}

function buildEslintTargets(
  eslintConfigs: string[],
  projectRoot: string,
  options: EslintPluginOptions,
  isStandaloneWorkspace = false
) {
  const isRootProject = projectRoot === '.';

  const targets: Record<string, TargetConfiguration> = {};

  const targetConfig: TargetConfiguration = {
    command: `eslint ${isRootProject && isStandaloneWorkspace ? './src' : '.'}`,
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
      '{workspaceRoot}/tools/eslint-rules/**/*',
      { externalDependencies: ['eslint'] },
    ],
  };
  if (eslintConfigs.some((config) => isFlatConfig(config))) {
    targetConfig.options.env = {
      ESLINT_USE_FLAT_CONFIG: 'true',
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
