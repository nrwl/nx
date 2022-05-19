import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  getProjects,
  logger,
  stripIndents,
  Tree,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import { join, normalize } from 'path';
import { SyntaxKind } from 'typescript';
import ts = require('typescript');

export async function migrateStoriesTo62Generator(tree: Tree) {
  let allComponentsWithStories: {
    componentName: string;
    componentPath: any;
    componentFileName: any;
    componentStoryPath: string;
  }[] = [];
  const result: {
    name: string;
    configFolder: string;
    projectRoot: string;
    projectSrc: string;
  }[] = findAllAngularProjectsWithStorybookConfiguration(tree);
  result?.forEach(
    (angularProjectWithStorybook: {
      name: string;
      configFolder: string;
      projectRoot: string;
      projectSrc: string;
    }) => {
      const componentResult = findAllComponentsWithStoriesForSpecificProject(
        tree,
        angularProjectWithStorybook.projectRoot
      );
      allComponentsWithStories = [
        ...allComponentsWithStories,
        ...componentResult,
      ];
    }
  );
  allComponentsWithStories?.forEach((componentInfo) => {
    changeSyntaxOfStory(tree, componentInfo.componentStoryPath);
  });
  await formatFiles(tree);
}

export function findAllAngularProjectsWithStorybookConfiguration(tree: Tree): {
  name: string;
  configFolder: string;
  projectRoot: string;
  projectSrc: string;
}[] {
  const projects = getProjects(tree);
  const projectsThatHaveStorybookConfiguration: {
    name: string;
    configFolder: string;
    projectRoot: string;
    projectSrc: string;
  }[] = [...projects.entries()]
    ?.filter(
      ([_, projectConfig]) =>
        projectConfig?.targets?.storybook?.options?.uiFramework ===
        '@storybook/angular'
    )
    ?.map(([projectName, projectConfig]) => {
      return {
        name: projectName,
        configFolder:
          projectConfig.targets.storybook?.options?.config?.configFolder,
        projectRoot: projectConfig.root,
        projectSrc: projectConfig.sourceRoot,
      };
    });
  return projectsThatHaveStorybookConfiguration;
}

function findAllComponentsWithStoriesForSpecificProject(
  tree: Tree,
  projectPath: string
): {
  componentName: string;
  componentPath: any;
  componentFileName: any;
  componentStoryPath: string;
}[] {
  let moduleFilePaths = [] as string[];
  visitNotIgnoredFiles(tree, projectPath, (filePath) => {
    if (filePath?.endsWith('.module.ts')) {
      moduleFilePaths.push(filePath);
    }
  });
  let componentFileInfos = [];
  moduleFilePaths?.map((moduleFilePath) => {
    const file = getTsSourceFile(tree, moduleFilePath);
    const ngModuleDecorators = findNodes(file, ts.SyntaxKind.Decorator);
    if (ngModuleDecorators.length === 0) {
      return;
    }
    const ngModuleDecorator = ngModuleDecorators[0];
    const ngModuleNode = ngModuleDecorator?.getChildren()?.find((node) => {
      return node?.getText()?.startsWith('NgModule');
    });
    const ngModulePropertiesObject = ngModuleNode
      ?.getChildren()
      ?.find((node) => {
        return node.kind === SyntaxKind.SyntaxList;
      });
    const ngModuleProperties = ngModulePropertiesObject
      ?.getChildren()[0]
      ?.getChildren()
      ?.find((node) => {
        return node?.getText()?.includes('declarations');
      });

    const declarationsPropertyAssignment = ngModuleProperties
      ?.getChildren()
      ?.find((node) => {
        return node?.getText()?.startsWith('declarations');
      });

    if (!declarationsPropertyAssignment) {
      logger.warn(stripIndents`No components declared in ${moduleFilePath}.`);
    }
    let declarationArray = declarationsPropertyAssignment
      ?.getChildren()
      ?.find((node) => node.kind === SyntaxKind.ArrayLiteralExpression);
    if (!declarationArray) {
      // Attempt to follow a variable instead of the literal
      const declarationVariable = declarationsPropertyAssignment
        ?.getChildren()
        ?.filter((node) => node.kind === SyntaxKind.Identifier)[1];
      const variableName = declarationVariable?.getText();
      const variableDeclaration = findNodes(
        file,
        SyntaxKind.VariableDeclaration
      )?.find((variableDeclaration) => {
        const identifier = variableDeclaration
          ?.getChildren()
          ?.find((node) => node.kind === SyntaxKind.Identifier);
        return identifier?.getText() === variableName;
      });
      if (variableDeclaration) {
        declarationArray = variableDeclaration
          ?.getChildren()
          ?.find((node) => node.kind === SyntaxKind.ArrayLiteralExpression);
      }
    }
    const declaredComponents = declarationArray
      ?.getChildren()
      ?.find((node) => node.kind === SyntaxKind.SyntaxList)
      ?.getChildren()
      ?.filter((node) => node.kind === SyntaxKind.Identifier)
      ?.map((node) => node?.getText())
      ?.filter((name) => name?.endsWith('Component'));
    const imports = file.statements?.filter(
      (statement) => statement.kind === SyntaxKind.ImportDeclaration
    );
    const modulePath = moduleFilePath.slice(
      0,
      moduleFilePath?.lastIndexOf('/')
    );
    let componentInfo = declaredComponents?.map((componentName) => {
      try {
        const importStatement = imports?.find((statement) => {
          const namedImports = statement
            ?.getChildren()
            ?.find((node) => node.kind === SyntaxKind.ImportClause)
            ?.getChildren()
            ?.find((node) => node.kind === SyntaxKind.NamedImports);
          if (namedImports === undefined) return false;
          const importedIdentifiers = namedImports
            ?.getChildren()
            ?.find((node) => node.kind === SyntaxKind.SyntaxList)
            ?.getChildren()
            ?.filter((node) => node.kind === SyntaxKind.ImportSpecifier)
            ?.map((node) => node?.getText());
          return importedIdentifiers?.includes(componentName);
        });

        const fullPath = importStatement
          ?.getChildren()
          ?.find((node) => node.kind === SyntaxKind.StringLiteral)
          ?.getText()
          ?.slice(1, -1);

        // if it is a directory, search recursively for the component
        let fullCmpImportPath = moduleFilePath?.slice(
          0,
          moduleFilePath?.lastIndexOf('/')
        );
        if (fullCmpImportPath?.startsWith('/')) {
          fullCmpImportPath = fullCmpImportPath?.slice(
            1,
            fullCmpImportPath.length
          );
        }
        let componentImportPath = join(normalize(fullCmpImportPath), fullPath);

        let path = null;
        let componentFileName = null;
        let componentStoryPath = null;
        let storyExists = false;
        let componentExists = false;
        /**
         * Here we want to remove the <component-name>.component
         * part of the path, to just keep the
         * apps/<project-name>/src/app/<component-name>
         * or
         * libs/<project-name>/src/lib/<component-name>
         * part of the path
         */
        componentImportPath = componentImportPath.slice(
          0,
          componentImportPath.lastIndexOf('/')
        );
        visitNotIgnoredFiles(tree, componentImportPath, (componentFilePath) => {
          if (componentFilePath?.endsWith('.ts')) {
            const content = tree.read(componentFilePath).toString('utf-8');

            if (content?.indexOf(`class ${componentName}`) > -1) {
              componentExists = true;
              path = componentFilePath;
              componentFileName =
                componentFilePath?.slice(
                  componentFilePath?.lastIndexOf('/') + 1,
                  componentFilePath?.lastIndexOf('.')
                ) + '.ts';
            }

            if (componentFilePath?.endsWith('.stories.ts')) {
              componentStoryPath = componentFilePath;
              storyExists = true;
            }
          }
        });
        if (!storyExists || !componentExists) {
          path = null;
          componentFileName = null;
          componentStoryPath = null;
        }
        if (path !== null) {
          return {
            componentName: componentName,
            componentPath: path,
            componentFileName,
            componentStoryPath: componentStoryPath,
          };
        } else {
          const path = fullPath?.slice(0, fullPath?.lastIndexOf('/'));
          const componentFileName =
            fullPath?.slice(fullPath?.lastIndexOf('/') + 1) + '.ts';

          componentStoryPath = fullPath + '.stories.ts';
          if (fileExists(componentStoryPath)) {
            return {
              componentName: componentName,
              componentPath: path + componentFileName,
              componentFileName,
              componentStoryPath: componentStoryPath,
            };
          } else {
            return undefined;
          }
        }
      } catch (e) {
        logger.warn(`Could not find file for ${componentName}. Error: ${e}`);
        return undefined;
      }
    });
    if (componentInfo) {
      componentInfo = componentInfo?.filter((info) => info !== undefined);
      componentFileInfos = [...componentFileInfos, ...componentInfo];
    }
  });
  return componentFileInfos;
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

async function changeSyntaxOfStory(tree: Tree, storyFilePath: string) {
  const file = getTsSourceFile(tree, storyFilePath);
  const appFileContent = tree.read(storyFilePath, 'utf-8');
  let newContents = appFileContent;
  const storiesVariableDeclaration = findNodes(file, [
    ts.SyntaxKind.VariableDeclaration,
  ]);
  const storiesExportDefault = findNodes(file, [
    ts.SyntaxKind.ExportAssignment,
  ]);

  const defaultExportNode = storiesExportDefault[0];
  const defaultExportObject = defaultExportNode?.getChildren()?.find((node) => {
    return node.kind === SyntaxKind.ObjectLiteralExpression;
  });
  const defaultPropertiesList = defaultExportObject
    ?.getChildren()
    ?.find((node) => {
      return node.kind === SyntaxKind.SyntaxList;
    });
  const hasTitle = defaultPropertiesList?.getChildren()?.find((node) => {
    return (
      node.kind === SyntaxKind.PropertyAssignment &&
      node.getText().startsWith('title')
    );
  });

  /**
   * A component node will look like this:
   *
   * component: MyTestComponent
   *
   * And this is what we need to remove.
   */
  let firstComponentNode: ts.Node;

  /**
   * The result of ts.Node.getStart() will give us the index
   * of that node in the whole original file.
   * While we're editing that file, the getStart() will
   * still reference the original file. So, during deletion,
   * it would go and delete characters using the original index.
   *
   * We need to save the length of the characters that have been removed
   * so far, so that we can substract it from the index.
   * Since it's parsing the file linearly and in order, then this
   * logic works.
   *  */

  let lengthOfRemovalsSoFar = 0;

  storiesVariableDeclaration?.forEach((oneStory) => {
    const oneExportedStoryArrowFunction = oneStory
      ?.getChildren()
      ?.find((node) => {
        return node.kind === SyntaxKind.ArrowFunction;
      });
    const inParenthesis = oneExportedStoryArrowFunction
      ?.getChildren()
      ?.find((node) => {
        return node.kind === SyntaxKind.ParenthesizedExpression;
      });
    const objectLiteralOfStory = inParenthesis?.getChildren()?.find((node) => {
      return node.kind === SyntaxKind.ObjectLiteralExpression;
    });
    const propertiesList = objectLiteralOfStory?.getChildren()?.find((node) => {
      return node.kind === SyntaxKind.SyntaxList;
    });

    const hasComponentDeclared = propertiesList?.getChildren()?.find((node) => {
      return (
        node.kind === SyntaxKind.PropertyAssignment &&
        node.getText().startsWith('component')
      );
    });

    if (hasComponentDeclared) {
      /**
       * Here I am saving the first component to appear
       * in the case where we have multiple stories
       */
      if (!firstComponentNode) {
        firstComponentNode = hasComponentDeclared;
      }

      /**
       * Here we are performing the following check:
       * If the component we will be adding in the default declaration
       * which is the first component that we find
       * is the same for this story as well,
       * then remove it.
       */

      if (hasComponentDeclared.getText() === firstComponentNode.getText()) {
        const indexOfPropertyName = hasComponentDeclared.getStart();
        const lengthOfRemoval = hasComponentDeclared?.getText()?.length + 1;
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Delete,
            start: indexOfPropertyName - lengthOfRemovalsSoFar,
            length: lengthOfRemoval,
          },
        ]);
        lengthOfRemovalsSoFar = lengthOfRemovalsSoFar + lengthOfRemoval;
      }
    }
  });

  if (hasTitle && firstComponentNode) {
    const indexOfPropertyName = hasTitle.getEnd();
    newContents = applyChangesToString(newContents, [
      {
        type: ChangeType.Insert,
        index: indexOfPropertyName + 2,
        text: firstComponentNode.getText() + ',',
      },
    ]);
    tree.write(storyFilePath, newContents);
  }

  await formatFiles(tree);
}
