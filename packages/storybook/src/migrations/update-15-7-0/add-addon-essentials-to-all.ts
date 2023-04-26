import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  logger,
  Tree,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { removeRootConfig } from './remove-root-config';
import ts = require('typescript');

/**
 * The purpose of this migrator is to help users move away
 * from the root .storybook/ configuration folder and files.
 *
 * Since we cannot be sure of how users make use of the root Storybook
 * directory, what we are going to do is the following:
 *
 * 1. Make sure that all project-level .storybook/main.js files contain
 * the @storybook/addon-essentials addon.
 * 2. If the root .storybook/main.js file contains the @storybook/addon-essentials remove it
 * from the root
 * 3. If there are things beyond the addons array in the root .storybook/main.js file,
 * then keep it as it is - inform user that they need to manually need to copy over any extra stuff
 * 4. If the root .storybook/main.js file is now empty, inform user that they can delete it safely
 *
 * Point the user to a guide that explains how to all these things.
 */

export default async function (tree: Tree) {
  const projectsThatFailedTOAddAddonEssentials =
    addAddonEssentialsToAllStorybooks(tree);

  if (projectsThatFailedTOAddAddonEssentials.length) {
    logger.info(
      `
          We could not add the @storybook/addon-essentials addon
          to the following projects' Storybook configurations:
    
          ${projectsThatFailedTOAddAddonEssentials.join(', ')}
    
          Please add it manually in the addons array of your project's
          .storybook/main.js|ts file.
          `
    );
  }

  const rootMainJsTsPath = tree.exists('.storybook/main.js')
    ? '.storybook/main.js'
    : tree.exists('.storybook/main.ts')
    ? '.storybook/main.ts'
    : undefined;

  if (rootMainJsTsPath) {
    const addonArrayOrEssentialsRemoved =
      removeAddonEssentialsFromRootStorybook(tree, rootMainJsTsPath);
    const storiesArrayRemoved = removeStoriesArrayFromRootIfEmpty(
      tree,
      rootMainJsTsPath
    );

    const removedRoot = removeRootConfig(tree, rootMainJsTsPath);

    if (removedRoot) {
      // Logs are already printed in the removeRootConfig function
    } else {
      logger.info(
        `
      We removed the ${
        addonArrayOrEssentialsRemoved === 'addons'
          ? 'addons array '
          : '@storybook/addon-essentials addon '
      } 
      ${storiesArrayRemoved ? 'and the stories array ' : ''}
      from the root .storybook/main.js|ts file.
      `
      );
    }
  }

  logger.info(
    `
    Read more about our effort to deprecate the root .storybook folder here:
    https://nx.dev/packages/storybook/documents/configuring-storybook
    `
  );

  await formatFiles(tree);
}

function removeAddonEssentialsFromRootStorybook(
  tree: Tree,
  rootMainJsTsPath: string
): 'addons' | 'esssentials' | undefined {
  let rootMainJsTs = tree.read(rootMainJsTsPath, 'utf-8');

  const addonEssentials = tsquery.query(
    rootMainJsTs,
    'StringLiteral:has([text="@storybook/addon-essentials"])'
  )?.[0];

  if (addonEssentials?.getText()?.length) {
    const fullAddonsNode = tsquery.query(
      rootMainJsTs,
      'PropertyAssignment:has([name="addons"])'
    )?.[0];

    const stringLiterals = tsquery.query(fullAddonsNode, 'StringLiteral');

    if (
      stringLiterals?.length === 1 &&
      stringLiterals?.[0]?.getText() === `'@storybook/addon-essentials'`
    ) {
      rootMainJsTs = applyChangesToString(rootMainJsTs, [
        {
          type: ChangeType.Delete,
          start: fullAddonsNode.getStart(),
          length:
            rootMainJsTs[fullAddonsNode.getEnd()] === ','
              ? fullAddonsNode.getText().length + 1
              : fullAddonsNode.getText().length,
        },
      ]);
      tree.write(rootMainJsTsPath, rootMainJsTs);

      return 'addons';
    } else {
      rootMainJsTs = applyChangesToString(rootMainJsTs, [
        {
          type: ChangeType.Delete,
          start: addonEssentials.getStart(),
          length:
            rootMainJsTs[addonEssentials.getEnd()] === ','
              ? addonEssentials.getText().length + 1
              : addonEssentials.getText().length,
        },
      ]);
      tree.write(rootMainJsTsPath, rootMainJsTs);
      return 'esssentials';
    }
  }
}

function addAddonEssentialsToAllStorybooks(tree: Tree): string[] {
  const projectsThatFailedTOAddAddonEssentials = [];
  forEachExecutorOptions(
    tree,
    '@nrwl/storybook:build',
    (options, projectName) => {
      const failedToAddAddon = addAddon(tree, options, projectName);
      if (failedToAddAddon) {
        projectsThatFailedTOAddAddonEssentials.push(failedToAddAddon);
      }
    }
  );

  forEachExecutorOptions(
    tree,
    '@storybook/angular:build-storybook',
    (options, projectName) => {
      const failedToAddAddon = addAddon(tree, options, projectName);
      if (failedToAddAddon) {
        projectsThatFailedTOAddAddonEssentials.push(failedToAddAddon);
      }
    }
  );
  return Array.from(new Set(projectsThatFailedTOAddAddonEssentials));
}

function addAddon(tree: Tree, options: {}, projectName: string): string {
  const storybookDir = options?.['configDir'];

  if (storybookDir) {
    const mainJsTsPath = tree.exists(`${storybookDir}/main.js`)
      ? `${storybookDir}/main.js`
      : tree.exists(`${storybookDir}/main.ts`)
      ? `${storybookDir}/main.ts`
      : undefined;

    let addedAddons = mainJsTsPath
      ? transformMainJsTs(tree, mainJsTsPath)
      : false;

    if ((storybookDir && !mainJsTsPath) || !addedAddons) {
      return projectName;
    }
  }
}

function transformMainJsTs(tree: Tree, mainJsTsPath: string): boolean {
  let mainJsTs = tree.read(mainJsTsPath, 'utf-8');

  const addonsArray = tsquery.query(
    mainJsTs,
    'ArrayLiteralExpression:has(Identifier[name="addons"])'
  )?.[0];

  if (addonsArray?.getText()?.length) {
    // If addons array does not contain @storybook/addon-essentials, add it
    if (!addonsArray.getText().includes('@storybook/addon-essentials')) {
      mainJsTs = applyChangesToString(mainJsTs, [
        {
          type: ChangeType.Insert,
          index: addonsArray.getStart() + 1,
          text: `'@storybook/addon-essentials', `,
        },
      ]);
      tree.write(mainJsTsPath, mainJsTs);
      return true;
    }
    return false;
  } else {
    // We will add the addons array after the stories array
    // If I have a stories array, that's where my addons need to go
    // And there's no config without stories

    const storiesArray = tsquery.query(
      mainJsTs,
      'ArrayLiteralExpression:has(Identifier[name="stories"])'
    )?.[0];

    if (storiesArray?.getText()?.length) {
      mainJsTs = applyChangesToString(mainJsTs, [
        {
          type: ChangeType.Insert,
          index: storiesArray.getEnd(),
          text: `, addons: ['@storybook/addon-essentials']`,
        },
      ]);
      tree.write(mainJsTsPath, mainJsTs);
      return true;
    } else {
      /**
       * main.js has potentially a different structure
       * sort of like this:
       * rootMain.addons.push(' ...)
       * rootMain.stories.push(' ...)
       * Like in older versions of Nx
       */

      const { rootMainVariableName, importExpression } =
        getRootMainVariableName(mainJsTs);

      // If there is a PropertyAccessExpression with the text rootMain.addons
      // then check if it has addon-essentials, if not add it
      const addonsPropertyAccessExpression = tsquery.query(
        mainJsTs,
        `PropertyAccessExpression:has([expression.name="${rootMainVariableName}"]):has([name="addons"])`
      )?.[0];

      if (rootMainVariableName && importExpression) {
        if (
          addonsPropertyAccessExpression?.getText() ===
          `${rootMainVariableName}.addons.push`
        ) {
          const parentCallExpression = addonsPropertyAccessExpression.parent;

          // see if parentCallExpression contains a StringLiteral with the text '@storybook/addon-essentials'
          const hasAddonEssentials = !!tsquery
            .query(
              parentCallExpression,
              `StringLiteral:has([text="@storybook/addon-essentials"])`
            )?.[0]
            ?.getText();

          if (!hasAddonEssentials) {
            mainJsTs = applyChangesToString(mainJsTs, [
              {
                type: ChangeType.Insert,
                index: addonsPropertyAccessExpression.getEnd() + 1,
                text: `'@storybook/addon-essentials', `,
              },
            ]);
            tree.write(mainJsTsPath, mainJsTs);
            return true;
          }
        } else {
          mainJsTs = applyChangesToString(mainJsTs, [
            {
              type: ChangeType.Insert,
              index: importExpression.getEnd() + 1,
              text: `${rootMainVariableName}.addons.push('@storybook/addon-essentials');`,
            },
          ]);
          tree.write(mainJsTsPath, mainJsTs);
          return true;
        }
      }
    }
    return false;
  }
}

function removeStoriesArrayFromRootIfEmpty(
  tree: Tree,
  rootMainJsTsPath: string
): boolean {
  if (rootMainJsTsPath) {
    let rootMainJsTs = tree.read(rootMainJsTsPath, 'utf-8');

    const fullStoriesNode = tsquery.query(
      rootMainJsTs,
      'PropertyAssignment:has([name="stories"])'
    )?.[0];

    if (!fullStoriesNode) {
      return false;
    }

    const stringLiterals = tsquery.query(fullStoriesNode, 'StringLiteral');

    if (stringLiterals?.length === 0) {
      rootMainJsTs = applyChangesToString(rootMainJsTs, [
        {
          type: ChangeType.Delete,
          start: fullStoriesNode.getStart(),
          length:
            rootMainJsTs[fullStoriesNode.getEnd()] === ','
              ? fullStoriesNode.getText().length + 1
              : fullStoriesNode.getText().length,
        },
      ]);
      tree.write(rootMainJsTsPath, rootMainJsTs);
      return true;
    }
  }
}

export function getRootMainVariableName(mainJsTs: string): {
  rootMainVariableName: string;
  importExpression: ts.Node;
} {
  const requireVariableStatement = tsquery.query(
    mainJsTs,
    `VariableStatement:has(CallExpression:has(Identifier[name="require"]))`
  );

  let rootMainVariableName;
  let importExpression;

  if (requireVariableStatement.length) {
    importExpression = requireVariableStatement.find((statement) => {
      const requireCallExpression = tsquery.query(
        statement,
        'CallExpression:has(Identifier[name="require"])'
      );
      return requireCallExpression?.[0]?.getText()?.includes('.storybook/main');
    });

    if (importExpression) {
      rootMainVariableName = tsquery
        .query(importExpression, 'Identifier')?.[0]
        ?.getText();
    }
  } else {
    const importDeclarations = tsquery.query(mainJsTs, 'ImportDeclaration');
    importExpression = importDeclarations.find((statement) => {
      const stringLiteral = tsquery.query(statement, 'StringLiteral');
      return stringLiteral?.[0]?.getText()?.includes('.storybook/main');
    });

    if (importExpression) {
      rootMainVariableName = tsquery
        .query(importExpression, 'ImportSpecifier')?.[0]
        ?.getText();
    }
  }

  return {
    rootMainVariableName,
    importExpression,
  };
}
