import {
  formatFiles,
  Tree,
  logger,
  updateJson,
  applyChangesToString,
  ChangeType,
} from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import { getTsSourceFile } from '../../utils/utilities';
import ts = require('typescript');

let needsInstall = false;
const targetStorybookVersion = '6.3.0';

function installAddonEssentials(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.dependencies = json.dependencies || {};
    json.devDependencies = json.devDependencies || {};

    if (
      !json.dependencies['@storybook/addon-essentials'] &&
      !json.devDependencies['@storybook/addon-essentials']
    ) {
      needsInstall = true;
      json.devDependencies[
        '@storybook/addon-essentials'
      ] = `~${targetStorybookVersion}`;
    }

    return json;
  });
}

function editRootMainJs(tree: Tree) {
  let newContents: string;
  let moduleExportsIsEmptyOrNonExistent = false;
  let alreadyHasAddonEssentials: any;
  const rootMainJsExists = tree.exists(`.storybook/main.js`);
  if (rootMainJsExists) {
    const file = getTsSourceFile(tree, '.storybook/main.js');
    const appFileContent = tree.read('.storybook/main.js', 'utf-8');
    newContents = appFileContent;
    const moduleExportsFull = findNodes(file, [
      ts.SyntaxKind.ExpressionStatement,
    ]);

    if (moduleExportsFull && moduleExportsFull[0]) {
      const moduleExports = moduleExportsFull[0];
      const listOfStatements = findNodes(moduleExports, [
        ts.SyntaxKind.SyntaxList,
      ]);

      let indexOfFirstNode = -1;

      const hasAddonsArray = listOfStatements[0]
        ?.getChildren()
        ?.find((node) => {
          if (node && node.getText().length > 0 && indexOfFirstNode < 0) {
            indexOfFirstNode = node.getStart();
          }
          return (
            node.kind === ts.SyntaxKind.PropertyAssignment &&
            node.getText().startsWith('addons')
          );
        });

      if (hasAddonsArray) {
        const listOfAllTSSyntaxElements = hasAddonsArray
          .getChildren()
          .find((node) => {
            return node.kind === ts.SyntaxKind.ArrayLiteralExpression;
          });

        const listIndex = listOfAllTSSyntaxElements.getStart();

        const theActualAddonsList = listOfAllTSSyntaxElements
          .getChildren()
          .find((node) => {
            return node.kind === ts.SyntaxKind.SyntaxList;
          });

        alreadyHasAddonEssentials = theActualAddonsList
          .getChildren()
          .find((node) => {
            return node.getText() === "'@storybook/addon-essentials'";
          });

        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Insert,
            index: listIndex + 1,
            text: "'@storybook/addon-essentials', ",
          },
        ]);
      } else if (indexOfFirstNode >= 0) {
        /**
         * Does not have addos array,
         * so just write one, at the start.
         */
        newContents = applyChangesToString(newContents, [
          {
            type: ChangeType.Insert,
            index: indexOfFirstNode,
            text: "addons: ['@storybook/addon-essentials'], ",
          },
        ]);
      } else {
        /**
         * Module exports is empty, so write all a-new
         */
        moduleExportsIsEmptyOrNonExistent = true;
      }
    } else {
      /**
       * module.exports does not exist, so write all a-new
       */
      moduleExportsIsEmptyOrNonExistent = true;
    }
  } else {
    moduleExportsIsEmptyOrNonExistent = true;
  }

  if (moduleExportsIsEmptyOrNonExistent) {
    newContents = `
    module.exports = {
      stories: [],
      addons: ['@storybook/addon-essentials'],
    };
    `;
  }

  if (!alreadyHasAddonEssentials) {
    tree.write(`.storybook/main.js`, newContents);
  }
}

export default async function (tree: Tree) {
  editRootMainJs(tree);
  installAddonEssentials(tree);
  await formatFiles(tree);

  if (needsInstall) {
    logger.info(
      'Please make sure to run npm install or yarn install to get the latest packages added by this migration'
    );
  }
}
