import type { ProjectConfiguration, Tree } from '@nx/devkit';
import {
  formatFiles,
  offsetFromRoot,
  readProjectConfiguration,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import { Linter as LinterEnum } from '../utils/linter';
import { findEslintFile } from '../utils/eslint-file';
import { join } from 'path';
import { lintInitGenerator } from '../init/init';
import type { Linter } from 'eslint';
import {
  findLintTarget,
  migrateConfigToMonorepoStyle,
} from '../init/init-migration';
import { getProjects } from 'nx/src/generators/utils/project-configuration';
import { useFlatConfig } from '../../utils/flat-config';
import {
  createNodeList,
  generateFlatOverride,
  generateSpreadElement,
  stringifyNodeList,
} from '../utils/flat-config/ast-utils';

interface LintProjectOptions {
  project: string;
  linter?: LinterEnum;
  eslintFilePatterns?: string[];
  tsConfigPaths?: string[];
  skipFormat: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  unitTestRunner?: string;
  rootProject?: boolean;
}

export function mapLintPattern(
  projectRoot: string,
  extension: string,
  rootProject?: boolean
) {
  const infix = rootProject ? 'src/' : '';
  return `${projectRoot}/${infix}**/*.${extension}`;
}

export async function lintProjectGenerator(
  tree: Tree,
  options: LintProjectOptions
) {
  const installTask = lintInitGenerator(tree, {
    linter: options.linter,
    unitTestRunner: options.unitTestRunner,
    skipPackageJson: options.skipPackageJson,
    rootProject: options.rootProject,
  });
  const projectConfig = readProjectConfiguration(tree, options.project);

  const lintFilePatterns = options.eslintFilePatterns ?? [];
  if (isBuildableLibraryProject(projectConfig)) {
    lintFilePatterns.push(`${projectConfig.root}/package.json`);
  }

  projectConfig.targets['lint'] = {
    executor: '@nx/linter:eslint',
    outputs: ['{options.outputFile}'],
    options: {
      lintFilePatterns: lintFilePatterns,
    },
  };

  // we are adding new project which is not the root project or
  // companion e2e app so we should check if migration to
  // monorepo style is needed
  if (!options.rootProject) {
    const projects = {} as any;
    getProjects(tree).forEach((v, k) => (projects[k] = v));
    if (isMigrationToMonorepoNeeded(projects, tree)) {
      // we only migrate project configurations that have been created
      const filteredProjects = [];
      Object.entries(projects).forEach(([name, project]) => {
        if (name !== options.project) {
          filteredProjects.push(project);
        }
      });
      migrateConfigToMonorepoStyle(
        filteredProjects,
        tree,
        options.unitTestRunner
      );
    }
  }

  // our root `.eslintrc` is already the project config, so we should not override it
  // additionally, the companion e2e app would have `rootProject: true`
  // so we need to check for the root path as well
  if (!options.rootProject || projectConfig.root !== '.') {
    createEsLintConfiguration(
      tree,
      projectConfig,
      options.setParserOptionsProject
    );
  }

  updateProjectConfiguration(tree, options.project, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

function createEsLintConfiguration(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  setParserOptionsProject: boolean
) {
  const eslintConfig = findEslintFile(tree);
  const pathToRootConfig = eslintConfig
    ? `${offsetFromRoot(projectConfig.root)}${eslintConfig}`
    : undefined;
  const addDependencyChecks = isBuildableLibraryProject(projectConfig);

  const overrides: Linter.ConfigOverride<Linter.RulesRecord>[] = [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      /**
       * NOTE: We no longer set parserOptions.project by default when creating new projects.
       *
       * We have observed that users rarely add rules requiring type-checking to their Nx workspaces, and therefore
       * do not actually need the capabilites which parserOptions.project provides. When specifying parserOptions.project,
       * typescript-eslint needs to create full TypeScript Programs for you. When omitting it, it can perform a simple
       * parse (and AST tranformation) of the source files it encounters during a lint run, which is much faster and much
       * less memory intensive.
       *
       * In the rare case that users attempt to add rules requiring type-checking to their setup later on (and haven't set
       * parserOptions.project), the executor will attempt to look for the particular error typescript-eslint gives you
       * and provide feedback to the user.
       */
      parserOptions: !setParserOptionsProject
        ? undefined
        : {
            project: [`${projectConfig.root}/tsconfig.*?.json`],
          },
      /**
       * Having an empty rules object present makes it more obvious to the user where they would
       * extend things from if they needed to
       */
      rules: {},
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
    {
      files: ['*.js', '*.jsx'],
      rules: {},
    },
    ...(isBuildableLibraryProject(projectConfig)
      ? [
          {
            files: ['*.json'],
            parser: 'jsonc-eslint-parser',
            rules: {
              '@nx/dependency-checks': 'error',
            } as Linter.RulesRecord,
          },
        ]
      : []),
  ];

  if (useFlatConfig()) {
    const isCompatNeeded = !!eslintConfig || addDependencyChecks;
    const nodes = [];
    const importMap = new Map();
    if (eslintConfig) {
      importMap.set(pathToRootConfig, 'baseConfig');
      nodes.push(generateSpreadElement('baseConfig'));
    }
    overrides.forEach((override) => {
      nodes.push(generateFlatOverride(override, projectConfig.root));
    });
    const nodeList = createNodeList(importMap, nodes, isCompatNeeded);
    const content = stringifyNodeList(
      nodeList,
      projectConfig.root,
      'eslint.config.js'
    );
    tree.write(join(projectConfig.root, 'eslint.config.js'), content);
  } else {
    writeJson(tree, join(projectConfig.root, `.eslintrc.json`), {
      extends: eslintConfig ? [pathToRootConfig] : undefined,
      // Include project files to be linted since the global one excludes all files.
      ignorePatterns: ['!**/*'],
      overrides,
    });
  }
}

function isBuildableLibraryProject(
  projectConfig: ProjectConfiguration
): boolean {
  return (
    projectConfig.projectType === 'library' &&
    projectConfig.targets?.build &&
    !!projectConfig.targets.build
  );
}

/**
 * Detect based on the state of lint target configuration of the root project
 * if we should migrate eslint configs to monorepo style
 */
function isMigrationToMonorepoNeeded(
  projects: Record<string, ProjectConfiguration>,
  tree: Tree
): boolean {
  // the base config is already created, migration has been done
  if (tree.exists('.eslintrc.base.json')) {
    return false;
  }

  const configs = Object.values(projects);
  if (configs.length === 1) {
    return false;
  }

  // get root project
  const rootProject = configs.find((p) => p.root === '.');
  if (!rootProject || !rootProject.targets) {
    return false;
  }
  // find if root project has lint target
  const lintTarget = findLintTarget(rootProject);
  if (!lintTarget) {
    return false;
  }

  return true;
}
