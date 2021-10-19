import { getProjects, Tree } from '@nrwl/devkit';
import {
  logger,
  formatFiles,
  applyChangesToString,
  ChangeType,
} from '@nrwl/devkit';

import ts = require('typescript');
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';

export async function migrateToWebPack5(tree: Tree) {
  allReactProjectsWithStorybookConfiguration(tree).forEach((project) => {
    editProjectMainJs(
      tree,
      `${project.storybookConfigPath}/main.js`,
      project.projectName
    );
  });
  await formatFiles(tree);
}

export function workspaceHasStorybookForReact(
  packageJson: any
): string | undefined {
  return (
    packageJson.dependencies['@storybook/react'] ||
    packageJson.devDependencies['@storybook/react']
  );
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
  let moduleExportsFull: ts.Node[] = [];

  if (rootMainJsExists) {
    const file = getTsSourceFile(tree, projectMainJsFile);
    const appFileContent = tree.read(projectMainJsFile, 'utf-8');
    newContents = appFileContent;
    moduleExportsFull = findNodes(file, [ts.SyntaxKind.ExpressionStatement]);

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
    const usesOldSyntax = checkMainJsForOldSyntax(
      moduleExportsFull,
      newContents
    );
    if (moduleExportsFull.length > 0 && usesOldSyntax) {
      newContents = usesOldSyntax;
      tree.write(projectMainJsFile, newContents);
      return;
    } else {
      logger.info(
        `Please configure Storybook for project "${projectName}"", since it has not been configured properly.`
      );
      return;
    }
  }

  if (!alreadyHasBuilder) {
    tree.write(projectMainJsFile, newContents);
  }
}

export function checkMainJsForOldSyntax(
  nodeList: ts.Node[],
  fileContent: string
): string | undefined {
  let alreadyContainsBuilder = false;
  let coreNode: ts.Node | undefined;
  let hasCoreNode = false;
  const lastIndexOfFirstNode = nodeList[0].getEnd();

  if (!fileContent.includes('stories.push') || nodeList.length === 0) {
    return undefined;
  }

  // Go through the node list and find if the core object exists
  // If it does, then we need to check if it has the builder property
  // If it does not, then we need to add it
  for (let topNode of nodeList) {
    if (
      topNode.kind === ts.SyntaxKind.ExpressionStatement &&
      topNode.getChildren()?.length > 0
    ) {
      for (let node of topNode.getChildren()) {
        if (
          node.kind === ts.SyntaxKind.BinaryExpression &&
          node.getChildren()?.length
        ) {
          for (let childNode of node.getChildren()) {
            if (
              childNode.kind === ts.SyntaxKind.PropertyAccessExpression &&
              childNode.getChildren()?.length
            ) {
              for (let grandChildNode of childNode.getChildren()) {
                if (
                  grandChildNode.kind === ts.SyntaxKind.Identifier &&
                  grandChildNode.getText() === 'core'
                ) {
                  coreNode = node;
                  hasCoreNode = true;
                  break;
                }
              }
            }
            if (hasCoreNode) {
              break;
            }
          }
        }
        if (hasCoreNode) {
          if (coreNode.getChildren()?.length) {
            for (let coreChildNode of coreNode.getChildren()) {
              if (
                coreChildNode.kind === ts.SyntaxKind.ObjectLiteralExpression &&
                coreChildNode.getChildren()?.length
              ) {
                for (let coreChildNodeChild of coreChildNode.getChildren()) {
                  if (coreChildNodeChild.kind === ts.SyntaxKind.SyntaxList) {
                    for (let coreChildNodeGrandChild of coreChildNodeChild.getChildren()) {
                      if (
                        coreChildNodeGrandChild.kind ===
                          ts.SyntaxKind.PropertyAssignment &&
                        coreChildNodeGrandChild.getText().startsWith('builder')
                      ) {
                        for (let coreChildNodeGrandChildChild of coreChildNodeGrandChild.getChildren()) {
                          if (
                            coreChildNodeGrandChildChild.kind ===
                              ts.SyntaxKind.StringLiteral &&
                            coreChildNodeGrandChildChild.getText() ===
                              'webpack5'
                          ) {
                            alreadyContainsBuilder = true;
                            break;
                          }
                        }
                      }
                      if (alreadyContainsBuilder) {
                        break;
                      }
                    }
                  }
                  if (alreadyContainsBuilder) {
                    break;
                  }
                }
              }
              if (alreadyContainsBuilder) {
                break;
              }
            }
          }
          break;
        }
      }
    }
    if (hasCoreNode) {
      if (alreadyContainsBuilder) {
        break;
      } else {
        // Add builder
        const indexOfCoreNodeEnd = coreNode.getEnd();
        fileContent = applyChangesToString(fileContent, [
          {
            type: ChangeType.Insert,
            index: indexOfCoreNodeEnd - 1,
            text: ", builder: 'webpack5'",
          },
        ]);
        break;
      }
    }
  }

  if (!hasCoreNode) {
    fileContent = applyChangesToString(fileContent, [
      {
        type: ChangeType.Insert,
        index: lastIndexOfFirstNode + 1,
        text: "rootMain.core = { ...rootMain.core, builder: 'webpack5' };\n",
      },
    ]);
  }

  return fileContent;
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
