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

    const childProjectRoots = globWithWorkspaceContext(context.workspaceRoot, [
      '**/project.json',
      '**/package.json',
    ])
      .map((f) => dirname(f))
      .filter((dir) => {
        // Ignore root level package.json or project.json
        if (dir === '.') {
          return false;
        }
        // Ignore project roots where the project does not contain any lintable files
        const lintableFiles = globWithWorkspaceContext(
          join(context.workspaceRoot, dir),
          [`**/*.{${options.extensions.join(',')}}`]
        );
        return lintableFiles.length > 0;
      });

    const configDir = dirname(configFilePath);
    if (configDir === '.') {
      return {
        projects: getProjectsUsingRootESLintConfig(
          configFilePath,
          childProjectRoots,
          options,
          context
        ),
      };
    }

    return {
      projects: getProjectsUsingNestedEslintConfig(
        configFilePath,
        childProjectRoots,
        options,
        context
      ),
    };
  },
];

function getProjectsUsingRootESLintConfig(
  configFilePath: string,
  childProjectRoots: string[],
  options: EslintPluginOptions,
  context: CreateNodesContext
): CreateNodesResult['projects'] {
  const projects: CreateNodesResult['projects'] = {};

  // If there's no src folder, it's not a standalone project, so a project.json would be explicitly required to add the root to the mapping
  const isStandaloneWorkspace =
    existsSync(join(context.workspaceRoot, 'src')) &&
    existsSync(join(context.workspaceRoot, 'package.json'));

  if (isStandaloneWorkspace) {
    projects['.'] = {
      targets: buildEslintTargets([configFilePath], '.', options, true),
    };
  } else if (existsSync(join(context.workspaceRoot, 'project.json'))) {
    projects['.'] = {
      targets: buildEslintTargets([configFilePath], '.', options),
    };
  }

  // Some nested projects may require a lint target based on this root level config as well (in the case they don't have their own)

  // See if any child project roots do not have a matching eslint config
  const childProjectsWithoutEslintConfig = childProjectRoots.filter(
    (childProjectRoot) =>
      !ESLINT_CONFIG_FILENAMES.some((eslintConfigFile) =>
        context.configFiles.includes(join(childProjectRoot, eslintConfigFile))
      )
  );

  // Add a lint target for each child project without an eslint config, with the root level config as an input
  for (const childProjectRoot of childProjectsWithoutEslintConfig) {
    projects[childProjectRoot] = {
      targets: buildEslintTargets([configFilePath], childProjectRoot, options),
    };
  }

  return projects;
}

// We are dealing with a nested eslint config, add a target if a project.json or package.json is found
function getProjectsUsingNestedEslintConfig(
  configFilePath: string,
  childProjectRoots: string[],
  options: EslintPluginOptions,
  context: CreateNodesContext
): CreateNodesResult['projects'] {
  const projects: CreateNodesResult['projects'] = {};
  const configDir = dirname(configFilePath);
  const configFileInputs = [configFilePath];

  const getRootConfig = (): string | undefined => {
    const rootFiles = context.configFiles.filter((f) => !f.includes('/'));
    return rootFiles.find(
      (f) =>
        ESLINT_CONFIG_FILENAMES.some((eslintConfigFile) =>
          f.endsWith(eslintConfigFile)
        ) ||
        f === baseEsLintConfigFile ||
        f === baseEsLintFlatConfigFile
    );
  };

  // Check if the current config is orphaned (not associated with a project)
  const isOrphaned = !childProjectRoots.includes(configDir);

  if (isOrphaned) {
    const projectRootsUnderConfigDir = childProjectRoots.filter((root) =>
      root.startsWith(configDir)
    );
    // Add the root level config as an input if it exists
    const rootEslintConfig = getRootConfig();
    if (rootEslintConfig) {
      configFileInputs.unshift(rootEslintConfig);
    }
    // If any of the project roots under the config dir do not have their own eslint config file, add the target
    for (const projectRoot of projectRootsUnderConfigDir) {
      if (
        !ESLINT_CONFIG_FILENAMES.some((eslintConfigFile) =>
          context.configFiles.includes(join(projectRoot, eslintConfigFile))
        )
      ) {
        projects[projectRoot] = {
          targets: buildEslintTargets(configFileInputs, projectRoot, options),
        };
      }
    }
    return projects;
  }

  if (childProjectRoots.includes(configDir)) {
    // Add the root level config as an input if it exists
    const rootEslintConfig = getRootConfig();
    if (rootEslintConfig) {
      configFileInputs.unshift(rootEslintConfig);
    }
    projects[configDir] = {
      targets: buildEslintTargets(configFileInputs, configDir, options),
    };
    return projects;
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
