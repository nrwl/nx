import {
  CreateNodes,
  CreateNodesContext,
  CreateNodesResult,
  TargetConfiguration,
} from '@nx/devkit';
import type { ESLint } from 'eslint';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
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
  async (configFilePath, options, context) => {
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

    const projectFiles = globWithWorkspaceContext(
      context.workspaceRoot,
      [
        'project.json',
        'package.json',
        '**/project.json',
        '**/package.json',
      ].map((f) => join(configDir, f)),
      nestedEslintRootPatterns.length ? nestedEslintRootPatterns : undefined
    );
    // dedupe and sort project roots by depth for more efficient traversal
    const dedupedProjectRoots = Array.from(
      new Set(projectFiles.map((f) => dirname(f)))
    ).sort((a, b) => (a !== b && isSubDir(a, b) ? -1 : 1));
    const excludePatterns = dedupedProjectRoots.map((root) => `${root}/**/*`);

    const ESLint = resolveESLintClass(isFlatConfig(configFilePath));
    const childProjectRoots = new Set<string>();

    await Promise.all(
      dedupedProjectRoots.map(async (childProjectRoot, index) => {
        // anything after is either a nested project or a sibling project, can be excluded
        const nestedProjectRootPatterns = excludePatterns.slice(index + 1);

        // Ignore project roots where the project does not contain any lintable files
        const lintableFiles = globWithWorkspaceContext(
          context.workspaceRoot,
          [join(childProjectRoot, `**/*.{${options.extensions.join(',')}}`)],
          // exclude nested eslint roots and nested project roots
          [...nestedEslintRootPatterns, ...nestedProjectRootPatterns]
        );
        const eslint = new ESLint({
          cwd: join(context.workspaceRoot, childProjectRoot),
        });
        for (const file of lintableFiles) {
          if (
            !(await eslint.isPathIgnored(join(context.workspaceRoot, file)))
          ) {
            childProjectRoots.add(childProjectRoot);
            break;
          }
        }
      })
    );

    const uniqueChildProjectRoots = Array.from(childProjectRoots);

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

  const rootEslintConfig = [
    baseEsLintConfigFile,
    baseEsLintFlatConfigFile,
    ...ESLINT_CONFIG_FILENAMES,
  ].find((f) => existsSync(join(context.workspaceRoot, f)));

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
        context.workspaceRoot,
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
  workspaceRoot: string,
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
      ...(existsSync(join(workspaceRoot, projectRoot, '.eslintignore'))
        ? ['{projectRoot}/.eslintignore']
        : []),
      '{workspaceRoot}/tools/eslint-rules/**/*',
      { externalDependencies: ['eslint'] },
    ],
    outputs: ['{options.outputFile}'],
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

function resolveESLintClass(useFlatConfig = false): typeof ESLint {
  try {
    if (!useFlatConfig) {
      return require('eslint').ESLint;
    }

    return require('eslint/use-at-your-own-risk').FlatESLint;
  } catch {
    throw new Error('Unable to find ESLint. Ensure ESLint is installed.');
  }
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
