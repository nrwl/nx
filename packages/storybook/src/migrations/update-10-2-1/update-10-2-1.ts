import * as path from 'path';
import {
  chain,
  Tree,
  SchematicContext,
  Rule,
} from '@angular-devkit/schematics';

import {
  formatFiles,
  updateWorkspaceInTree,
  readJsonInTree,
} from '@nrwl/workspace';

import { TsConfig } from '../../utils/utilities';
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

export default function () {
  return chain([updateTsConfig, formatFiles()]);
}

function updateTsConfig(): Rule {
  return updateWorkspaceInTree((config, context, tree) => {
    Object.entries<ProjectDefinition>(config.projects).forEach(
      ([projectName, projectConfig]) => {
        updateStorybookTsConfigPath(tree, context, {
          projectName,
          projectConfig,
        });
      }
    );

    return config;
  });
}

function updateStorybookTsConfigPath(
  tree: Tree,
  context: SchematicContext,
  options: {
    projectName: string;
    projectConfig: ProjectDefinition;
  }
) {
  const architect = options.projectConfig.architect;

  const paths = {
    tsConfigStorybook: path.join(
      options.projectConfig.root,
      '.storybook/tsconfig.json'
    ),
  };

  const hasStorybookConfig =
    architect && architect.storybook && tree.exists(paths.tsConfigStorybook);

  if (!hasStorybookConfig) {
    context.logger.info(
      `${options.projectName}: no storybook configured. skipping migration...`
    );
    return;
  }

  const tsConfig = {
    storybook: readJsonInTree<TsConfig>(tree, paths.tsConfigStorybook),
  };

  // update extends prop to point to the lib relative tsconfig rather
  // than the root tsconfig.base.json
  tsConfig.storybook.extends = '../tsconfig.json';
  tree.overwrite(paths.tsConfigStorybook, serializeJson(tsConfig.storybook));
}
