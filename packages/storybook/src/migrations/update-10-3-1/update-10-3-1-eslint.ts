import * as path from 'path';
import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { formatFiles, readWorkspace, updateJsonInTree } from '@nrwl/workspace';
import { isFramework } from '../../utils/utils';

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
  return chain([updateEsLintExcludes, formatFiles()]);
}

function updateEsLintExcludes(tree: Tree, context: SchematicContext) {
  const workspaceConfig = readWorkspace(tree);

  const updates = [];

  Object.entries<ProjectDefinition>(workspaceConfig.projects).forEach(
    ([projectName, projectConfig]) => {
      const architect = projectConfig.architect;

      const hasStorybookConfig =
        architect.storybook &&
        tree.exists(path.join(projectConfig.root, '.storybook/tsconfig.json'));

      if (!hasStorybookConfig) {
        context.logger.info(
          `${projectName}: no storybook configured. skipping migration...`
        );
      } else {
        updates.push(updateEsLintExclude(tree, context, { projectConfig }));
      }
    }
  );

  return chain(updates.filter((x) => !!x));
}

function updateEsLintExclude(
  tree: Tree,
  context: SchematicContext,
  { projectConfig }: { projectConfig: ProjectDefinition }
) {
  const architect = projectConfig.architect;

  const isReactProject = isFramework('react', {
    uiFramework: architect.storybook.options?.uiFramework as Parameters<
      typeof isFramework
    >[1]['uiFramework'],
  });

  if (isReactProject) {
    const isUsingESLint =
      (projectConfig.architect?.lint?.builder === '@nrwl/linter:lint' &&
        projectConfig.architect?.lint?.options?.linter === 'eslint') ||
      projectConfig.architect?.lint?.builder === '@nrwl/linter:eslint';

    if (!isUsingESLint) {
      return;
    }

    return updateJsonInTree(`${projectConfig.root}/.eslintrc.json`, (json) => {
      if (!json.ignorePatterns.some((x) => x.indexOf('.storybook/') > -1)) {
        json.ignorePatterns = [...json.ignorePatterns, '.storybook/*'];
      }

      return json;
    });
  }
}
