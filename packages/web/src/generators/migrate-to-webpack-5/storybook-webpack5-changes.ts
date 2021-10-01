import { getProjects, Tree } from '@nrwl/devkit';
import {
  logger,
  formatFiles,
  applyChangesToString,
  ChangeType,
} from '@nrwl/devkit';

import ts = require('typescript');
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';

export function workspaceHasStorybookForReact(
  packageJson: any
): string | undefined {
  return (
    packageJson.dependencies['@storybook/react'] ||
    packageJson.devDependencies['@storybook/react']
  );
}

export async function migrateStorybookToWebPack5(tree: Tree) {
  allReactProjectsWithStorybookConfiguration(tree).forEach((project) => {
    editProjectMainJs(
      tree,
      `${project.storybookConfigPath}/main.js`,
      project.projectName
    );
  });
  await formatFiles(tree);
}

export function allReactProjectsWithStorybookConfiguration(tree: Tree): {
  projectName: string;
  storybookConfigPath: string;
}[] {
  const projects = getProjects(tree);
  const reactProjectsThatHaveStorybookConfiguration: {
    projectName: string;
    storybookConfigPath: string;
  }[] = [...projects.entries()]
    ?.filter(
      ([_, projectConfig]) =>
        projectConfig.targets &&
        projectConfig.targets.storybook &&
        projectConfig.targets.storybook.options
    )
    ?.map(([projectName, projectConfig]) => {
      if (
        projectConfig.targets &&
        projectConfig.targets.storybook &&
        projectConfig.targets.storybook.options?.config?.configFolder &&
        projectConfig.targets.storybook.options?.uiFramework ===
          '@storybook/react'
      ) {
        return {
          projectName,
          storybookConfigPath:
            projectConfig.targets.storybook.options.config.configFolder,
        };
      }
    });
  return reactProjectsThatHaveStorybookConfiguration;
}

export function editProjectMainJs(
  tree: Tree,
  projectMainJsFile: string,
  projectName: string
) {
  let newContents: string;
  let moduleExportsIsEmptyOrNonExistentOrInvalid = false;
  let alreadyHasBuilder: any;
  const rootMainJsExists = tree.exists(projectMainJsFile);
  if (rootMainJsExists) {
    const file = getTsSourceFile(tree, projectMainJsFile);
    const appFileContent = tree.read(projectMainJsFile, 'utf-8');
    newContents = appFileContent;
    const moduleExportsFull = findNodes(file, [
      ts.SyntaxKind.ExpressionStatement,
    ]);

    if (moduleExportsFull && moduleExportsFull[0]) {
      const moduleExports = moduleExportsFull[0];
      const listOfStatements = findNodes(moduleExports, [
        ts.SyntaxKind.SyntaxList,
      ]);

      /**
       * Keep the index of the stories node
       * to put the core object before it
       * if it does not exist already
       */

      let indexOfStoriesNode = -1;

      const hasCoreObject = listOfStatements[0]?.getChildren()?.find((node) => {
        if (
          node &&
          node.getText().length > 0 &&
          indexOfStoriesNode < 0 &&
          node?.getText().startsWith('stories')
        ) {
          indexOfStoriesNode = node.getStart();
        }
        return (
          node?.kind === ts.SyntaxKind.PropertyAssignment &&
          node?.getText().startsWith('core')
        );
      });

      if (hasCoreObject) {
        const contentsOfCoreNode = hasCoreObject.getChildren().find((node) => {
          return node.kind === ts.SyntaxKind.ObjectLiteralExpression;
        });
        const everyAttributeInsideCoreNode = contentsOfCoreNode
          .getChildren()
          .find((node) => node.kind === ts.SyntaxKind.SyntaxList);

        alreadyHasBuilder = everyAttributeInsideCoreNode
          .getChildren()
          .find((node) => node.getText() === "builder: 'webpack5'");

        if (!alreadyHasBuilder) {
          newContents = applyChangesToString(newContents, [
            {
              type: ChangeType.Insert,
              index: contentsOfCoreNode.getEnd() - 1,
              text: ", builder: 'webpack5'",
            },
          ]);
        }
      } else if (indexOfStoriesNode >= 0) {
        /**
         * Does not have core object,
         * so just write one, at the start.
         */
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Insert,
            index: indexOfStoriesNode - 1,
            text: "core: { ...rootMain.core, builder: 'webpack5' }, ",
          },
        ]);
      } else {
        /**
         * Module exports is empty or does not
         * contain stories - most probably invalid
         */
        moduleExportsIsEmptyOrNonExistentOrInvalid = true;
      }
    } else {
      /**
       * module.exports does not exist
       */
      moduleExportsIsEmptyOrNonExistentOrInvalid = true;
    }
  } else {
    moduleExportsIsEmptyOrNonExistentOrInvalid = true;
  }

  if (moduleExportsIsEmptyOrNonExistentOrInvalid) {
    logger.info(
      `Please configure Storybook for project "${projectName}"", since it has not been configured properly.`
    );
    return;
  }

  if (!alreadyHasBuilder) {
    tree.write(projectMainJsFile, newContents);
  }
}

export function getTsSourceFile(host: Tree, path: string): ts.SourceFile {
  const buffer = host.read(path);
  if (!buffer) {
    throw new Error(`Could not read TS file (${path}).`);
  }
  const content = buffer.toString();
  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return source;
}
