import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  readJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { output } from 'nx/src/utils/output';
import { litVersion } from '../../utils/versions';
import { callAutomigrate, callUpgrade } from './calling-storybook-cli';
import {
  afterMigration,
  checkStorybookInstalled,
  checkWebComponentsInstalled,
  getAllStorybookInfo,
  handleMigrationResult,
  logResult,
  onlyShowGuide,
  prepareFiles,
  removeUiFrameworkFromProjectJson,
} from './helper-functions';
import { Schema } from './schema';

export async function migrate7Generator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const packageJson = readJson(tree, 'package.json');
  if (!checkStorybookInstalled(packageJson)) {
    output.error({
      title: 'No Storybook packages installed',
      bodyLines: [
        `🚨 Nx did not find any Storybook packages installed in your workspace.`,
        `So no migration is necessary.`,
      ],
    });
    return;
  }

  const allStorybookProjects: {
    [key: string]: {
      configDir: string;
      uiFramework: string;
      viteConfigFilePath?: string;
    };
  } = getAllStorybookInfo(tree);

  let migrateResult: {
    successfulProjects: {};
    failedProjects: {};
  };
  if (schema.onlyShowListOfCommands) {
    onlyShowGuide(allStorybookProjects);
    return;
  }
  if (!schema.afterMigration) {
    if (!schema.noUpgrade) {
      callUpgrade(schema);
    }

    if (Object.entries(allStorybookProjects).length) {
      prepareFiles(tree, allStorybookProjects);
      if (schema.onlyPrepare) {
        return;
      }

      migrateResult = callAutomigrate(allStorybookProjects, schema);

      migrateResult = handleMigrationResult(
        migrateResult,
        allStorybookProjects
      );
    }
  }
  output.log({
    title: `Final adjustments`,
    bodyLines: [
      `We are now running some final adjustments to your configuration files.`,
      `The adjustments are:`,
      ` - Remove the "vite-tsconfig-paths" plugin from the Storybook configuration files since it's no longer needed`,
      ` - Add the "viteConfigPath" option to the Storybook builder, where needed`,
      ` - Change the import package for the StorybookConfig type to be framework specific`,
      ` - Add the "lit" package to your workspace, if you are using Web Components`,
      ` - Remove the "uiFramework" option from your project's Storybook targets`,
    ],
    color: 'blue',
  });

  if (Object.entries(allStorybookProjects).length) {
    afterMigration(tree, allStorybookProjects);
  }

  if (checkWebComponentsInstalled(packageJson)) {
    tasks.push(addDependenciesToPackageJson(tree, {}, { lit: litVersion }));
  }

  removeUiFrameworkFromProjectJson(tree);

  if (!schema.afterMigration) {
    logResult(tree, migrateResult);
  }

  await formatFiles(tree);
  return runTasksInSerial(...tasks);
}

export default migrate7Generator;
export const migrate7Schematic = convertNxGenerator(migrate7Generator);
