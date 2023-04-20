import {
  applyChangesToString,
  ChangeType,
  logger,
  StringChange,
  Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { getRootMainVariableName } from './add-addon-essentials-to-all';
import ts = require('typescript');

/**
 * The purpose of this migrator is to help users move away
 * from the root .storybook/ configuration folder and files.
 *
 * This is the second part of the migrator.
 *
 * If the root main.js file is empty, then we can safely delete it
 * and also remove all the references to it from the project-level
 * Storybook configuration files.
 *
 * Point the user to a guide that explains how to all these things.
 */

export function removeRootConfig(
  tree: Tree,
  rootMainJsTsPath: string
): boolean {
  if (checkIfRootMainJsTsIsEmpty(tree, rootMainJsTsPath)) {
    const hasRemainingRootMainJsReferences = removeImportFromAllFiles(tree);
    tree.delete(rootMainJsTsPath);
    logger.warn(
      `
      We removed the root ${rootMainJsTsPath} file and we also
      removed all it's imports from all project-level Storybook configuration files.
      `
    );

    if (hasRemainingRootMainJsReferences.length) {
      logger.warn(
        `
        However, there are still other references to the root .storybook/main.js|ts file 
        in the following files: 

        ${hasRemainingRootMainJsReferences.join('\n')}

        Please remove them manually.
      `
      );
    }

    return true;
  }
}

function removeImportFromAllFiles(tree: Tree): string[] {
  const hasRemainingRootMainJsReferences = [];
  forEachExecutorOptions(tree, '@nrwl/storybook:build', (options) => {
    const hasRemainingReference = makeTheChanges(tree, options);
    if (hasRemainingReference) {
      hasRemainingRootMainJsReferences.push(hasRemainingReference);
    }
  });

  forEachExecutorOptions(
    tree,
    '@storybook/angular:build-storybook',
    (options) => {
      const hasRemainingReference = makeTheChanges(tree, options);
      if (hasRemainingReference) {
        hasRemainingRootMainJsReferences.push(hasRemainingReference);
      }
    }
  );
  return hasRemainingRootMainJsReferences;
}

function makeTheChanges(tree: Tree, options: {}): string | undefined {
  const storybookDir = options?.['configDir'];

  if (storybookDir) {
    const mainJsTsPath = tree.exists(`${storybookDir}/main.js`)
      ? `${storybookDir}/main.js`
      : tree.exists(`${storybookDir}/main.ts`)
      ? `${storybookDir}/main.ts`
      : undefined;

    if (mainJsTsPath) {
      let mainJsTs = tree.read(mainJsTsPath, 'utf-8');

      const { rootMainVariableName, importExpression } =
        getRootMainVariableName(mainJsTs);

      if (importExpression && rootMainVariableName) {
        const changesToBeMade: StringChange[] = [
          {
            type: ChangeType.Delete,
            start: importExpression.getStart(),
            length: importExpression.getText().length,
          },
        ];

        const spreadElements = tsquery.query(
          mainJsTs,
          `SpreadElement:has(Identifier[name="${rootMainVariableName}"])`
        );
        spreadElements.forEach((spreadElement) => {
          changesToBeMade.push({
            type: ChangeType.Delete,
            start: spreadElement.getStart(),
            length:
              mainJsTs[spreadElement.getEnd()] === ','
                ? spreadElement.getText().length + 1
                : spreadElement.getText().length,
          });
        });

        const spreadAssignments = tsquery.query(
          mainJsTs,
          `SpreadAssignment:has(Identifier[name="${rootMainVariableName}"])`
        );
        spreadAssignments.forEach((spreadAssignment) => {
          changesToBeMade.push({
            type: ChangeType.Delete,
            start: spreadAssignment.getStart(),
            length:
              mainJsTs[spreadAssignment.getEnd()] === ','
                ? spreadAssignment.getText().length + 1
                : spreadAssignment.getText().length,
          });
        });

        const findOtherRootMainUses = tsquery.query(
          mainJsTs,
          `Identifier[name="${rootMainVariableName}"]`
        );

        findOtherRootMainUses.forEach((otherRootMainUse) => {
          /**
           * This would be mainly to remove the legacy
           *
           * if (rootMain.webpackFinal) {
           *    config = await rootMain.webpackFinal(config, { configType });
           * }
           */
          if (
            otherRootMainUse.parent.kind ===
              ts.SyntaxKind.PropertyAccessExpression &&
            otherRootMainUse.parent.parent?.kind === ts.SyntaxKind.IfStatement
          ) {
            changesToBeMade.push({
              type: ChangeType.Delete,
              start: otherRootMainUse.parent.parent.getStart(),
              length: otherRootMainUse.parent.parent.getText().length + 1,
            });
          }
        });

        mainJsTs = applyChangesToString(mainJsTs, [...changesToBeMade]);
        tree.write(mainJsTsPath, mainJsTs);

        if (hasMoreRootMainUses(tree, mainJsTsPath, rootMainVariableName)) {
          if (
            checkIfUsesOldSyntaxAndUpdate(
              tree,
              mainJsTsPath,
              rootMainVariableName
            )
          ) {
            return undefined;
          }
          return mainJsTsPath;
        }
      }
    }
  }
}

function checkIfUsesOldSyntaxAndUpdate(
  tree: Tree,
  filePath: string,
  rootMainVariableName: string
): boolean {
  const mainJsTs = tree.read(filePath, 'utf-8');
  const changesToBeMade: StringChange[] = [];
  const { stringArray: addonsArrayString, expressionToDelete: addonsToDelete } =
    getPropertyArray('addons', mainJsTs, rootMainVariableName);

  const {
    stringArray: storiesArrayString,
    expressionToDelete: storiesToDelete,
  } = getPropertyArray('stories', mainJsTs, rootMainVariableName);

  if (storiesToDelete) {
    changesToBeMade.push(storiesToDelete);
  }
  if (addonsToDelete) {
    changesToBeMade.push(addonsToDelete);
  }

  if (addArrayToModuleExports('addons', mainJsTs, addonsArrayString)) {
    changesToBeMade.push(
      addArrayToModuleExports('addons', mainJsTs, addonsArrayString)
    );
  }

  if (addArrayToModuleExports('stories', mainJsTs, storiesArrayString)) {
    changesToBeMade.push(
      addArrayToModuleExports('stories', mainJsTs, storiesArrayString)
    );
  }

  if (changesToBeMade.length) {
    tree.write(filePath, applyChangesToString(mainJsTs, changesToBeMade));
    return true;
  }
}

function addArrayToModuleExports(
  propertyName: string,
  mainJsTs: string,
  arrayString: string
): StringChange {
  if (!arrayString) {
    return;
  }

  const moduleExports = tsquery.query(
    mainJsTs,
    `PropertyAccessExpression:has([expression.name="module"]):has([name="exports"]):has([name="${propertyName}"])`
  )?.[0];
  if (moduleExports) {
    const parentBinaryExpression = moduleExports.parent;
    const arrayExpression = tsquery.query(
      parentBinaryExpression,
      `ArrayLiteralExpression`
    )?.[0];

    return {
      type: ChangeType.Insert,
      index: arrayExpression.getStart() + 1,
      text: arrayString,
    };
  } else {
    return {
      type: ChangeType.Insert,
      index: mainJsTs.length,
      text: `module.exports.${propertyName} = [${arrayString}];\n`,
    };
  }
}

function getPropertyArray(
  propertyName: string,
  mainJsTs: string,
  rootMainVariableName: string
): { stringArray: string; expressionToDelete: StringChange } {
  const propertyAccessExpression = tsquery.query(
    mainJsTs,
    `PropertyAccessExpression:has([expression.name="${rootMainVariableName}"]):has([name="${propertyName}"])`
  )?.[0];

  if (propertyAccessExpression) {
    if (
      propertyAccessExpression?.getText() ===
      `${rootMainVariableName}.${propertyName}.push`
    ) {
      const parentCallExpression = propertyAccessExpression.parent;
      const stringPropertyArray = tsquery
        .query(parentCallExpression, `StringLiteral`)
        .map((stringLiteral) => stringLiteral?.getText());

      return {
        stringArray: `${stringPropertyArray.join(', ')}`,
        expressionToDelete: {
          type: ChangeType.Delete,
          start: parentCallExpression.getStart(),
          length: parentCallExpression.getText().length + 1,
        },
      };
    }
  }
}

function hasMoreRootMainUses(
  tree: Tree,
  filePath: string,
  rootMainVariableName: string
): boolean {
  const mainJsTs = tree.read(filePath, 'utf-8');
  const findRemainingRootMainUses = tsquery.query(
    mainJsTs,
    `Identifier[name="${rootMainVariableName}"]`
  );
  return findRemainingRootMainUses?.length > 0;
}

function checkIfRootMainJsTsIsEmpty(tree: Tree, rootMainJsTsPath: string) {
  const rootMainJsTs = tree.read(rootMainJsTsPath, 'utf-8');
  const mainConfigObject = tsquery.query(
    rootMainJsTs,
    'ObjectLiteralExpression'
  );

  if (
    mainConfigObject?.length === 1 &&
    mainConfigObject[0]?.getText()?.replace(/\s/g, '') === '{}'
  ) {
    return true;
  }
}
