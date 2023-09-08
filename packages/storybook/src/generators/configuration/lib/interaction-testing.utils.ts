import {
  applyChangesToString,
  ChangeType,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  storybookJestVersion,
  storybookTestingLibraryVersion,
  storybookTestRunnerVersion,
  storybookVersion,
} from '../../../utils/versions';

export function interactionTestsDependencies(): { [key: string]: string } {
  return {
    '@storybook/test-runner': storybookTestRunnerVersion,
    '@storybook/addon-interactions': storybookVersion,
    '@storybook/testing-library': storybookTestingLibraryVersion,
    '@storybook/jest': storybookJestVersion,
  };
}

export function addInteractionsInAddons(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  const mainJsTsPath = getMainTsJsPath(tree, projectConfig);
  if (!mainJsTsPath) return;
  let mainJsTs = tree.read(mainJsTsPath, 'utf-8');
  if (!mainJsTs) return;

  // Find addons array
  const addonsArray = tsquery.query(
    mainJsTs,
    `PropertyAssignment:has(Identifier:has([name="addons"]))`
  )?.[0];

  // if there's no addons array don't do anything
  // they may be setting up storybook in another project
  if (!addonsArray) return;

  // Check if addons array already has addon-interactions
  const addonsArrayHasAddonInteractions = tsquery.query(
    addonsArray,
    `StringLiteral:has([text="@storybook/addon-interactions"])`
  )?.[0];
  if (addonsArrayHasAddonInteractions) return;

  // get the array of the addons
  const arrayLiteralExpression = tsquery.query(
    addonsArray,
    `ArrayLiteralExpression`
  )?.[0];
  if (!arrayLiteralExpression) return;
  mainJsTs = applyChangesToString(mainJsTs, [
    {
      type: ChangeType.Insert,
      index: arrayLiteralExpression.getStart() + 1,
      text: `'@storybook/addon-interactions', `,
    },
  ]);
  tree.write(mainJsTsPath, mainJsTs);
}

function getMainTsJsPath(
  host: Tree,
  projectConfig: ProjectConfiguration
): string | undefined {
  let mainJsTsPath: string | undefined = undefined;
  Object.entries(projectConfig.targets).forEach(
    ([_targetName, targetConfig]) => {
      if (
        targetConfig.executor === '@nx/storybook:storybook' ||
        targetConfig.executor === '@storybook/angular:start-storybook'
      ) {
        const configDir = targetConfig.options?.configDir;
        if (host.exists(`${configDir}/main.js`)) {
          mainJsTsPath = `${configDir}/main.js`;
        }
        if (host.exists(`${configDir}/main.ts`)) {
          mainJsTsPath = `${configDir}/main.ts`;
        }
      }
    }
  );
  return mainJsTsPath;
}
