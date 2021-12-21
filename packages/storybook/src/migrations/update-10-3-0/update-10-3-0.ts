import * as path from 'path';
import {
  chain,
  Tree,
  SchematicContext,
  Rule,
} from '@angular-devkit/schematics';

import {
  formatFiles,
  readJsonInTree,
  updateWorkspaceInTree,
} from '@nrwl/workspace';

import { isFramework, TsConfig } from '../../utils/utilities';
import { normalize } from '@angular-devkit/core';
import { serializeJson } from '@nrwl/devkit';

interface ProjectDefinition {
  root: string;
  sourceRoot: string;
  projectType: 'library' | 'application';

  schematic?: Record<string, any>;
  architect: Record<
    string,
    import('@angular-devkit/core').workspaces.TargetDefinition
  >;
}

export default function (tree: Tree, context: SchematicContext) {
  return chain([update, formatFiles()]);
}

function update(tree: Tree, context: SchematicContext): Rule {
  return updateWorkspaceInTree((config, context, tree) => {
    Object.entries<ProjectDefinition>(config.projects).forEach(
      ([projectName, projectConfig]) => {
        updateLintTarget(tree, context, { projectName, projectConfig });
      }
    );

    return config;
  });
}

function updateLintTarget(
  tree: Tree,
  context: SchematicContext,
  options: {
    projectName: string;
    projectConfig: ProjectDefinition;
  }
) {
  const architect = options.projectConfig.architect;

  const paths = {
    tsConfig: path.join(options.projectConfig.root, 'tsconfig.json'),
    tsConfigLib: path.join(options.projectConfig.root, 'tsconfig.lib.json'),
    tsConfigStorybook: normalize(
      path.join(options.projectConfig.root, '.storybook/tsconfig.json')
    ),
  };

  const hasStorybookConfig =
    architect.storybook && tree.exists(paths.tsConfigStorybook);

  if (!hasStorybookConfig) {
    context.logger.info(
      `${options.projectName}: no storybook configured. skipping migration...`
    );
    return;
  }

  const isReactProject = isFramework('react', {
    uiFramework: architect.storybook.options?.uiFramework as Parameters<
      typeof isFramework
    >[1]['uiFramework'],
  });

  const mainTsConfigContent = readJsonInTree<TsConfig>(tree, paths.tsConfig);

  const tsConfig = {
    main: mainTsConfigContent,
    lib: tree.exists(paths.tsConfigLib)
      ? readJsonInTree<TsConfig>(tree, paths.tsConfigLib)
      : mainTsConfigContent,
    storybook: readJsonInTree<TsConfig>(tree, paths.tsConfigStorybook),
  };

  if (isReactProject && Array.isArray(tsConfig.lib.exclude)) {
    tsConfig.lib.exclude = uniqueArray([
      ...tsConfig.lib.exclude,
      '**/*.stories.jsx',
      '**/*.stories.tsx',
    ]);
    tree.overwrite(paths.tsConfigLib, serializeJson(tsConfig.lib));
  }

  if (
    Array.isArray(tsConfig.main.references) &&
    tsConfig.main.references.every(
      (ref) => ref.path !== './.storybook/tsconfig.json'
    )
  ) {
    tsConfig.main.references.push({
      path: normalize('./.storybook/tsconfig.json'),
    });
    tree.overwrite(paths.tsConfig, serializeJson(tsConfig.main));
  }

  if (isReactProject && Array.isArray(tsConfig.storybook.exclude)) {
    tsConfig.storybook.exclude = uniqueArray([
      ...tsConfig.storybook.exclude,
      '../**/*.spec.js',
      '../**/*.spec.tsx',
      '../**/*.spec.jsx',
    ]);
    tree.overwrite(paths.tsConfigStorybook, serializeJson(tsConfig.storybook));
  }

  // update workspace
  if (
    architect.lint &&
    architect.lint.options &&
    Array.isArray(architect.lint.options.tsConfig)
  ) {
    architect.lint.options.tsConfig = uniqueArray([
      ...architect.lint.options.tsConfig,
      paths.tsConfigStorybook,
    ]);
  }
}

function uniqueArray<T extends Array<any>>(value: T) {
  return [...new Set(value)] as T;
}
