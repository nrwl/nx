import { formatFiles, readJson, Tree } from '@nx/devkit';

import { output } from 'nx/src/utils/output';
import { callAutomigrate, callUpgrade } from './calling-storybook-cli';
import {
  checkStorybookInstalled,
  getAllStorybookInfo,
  handleMigrationResult,
  logResult,
  onlyShowGuide,
} from './helper-functions';
import { Schema } from './schema';

export async function migrate8Generator(tree: Tree, schema: Schema) {
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
    };
  } = getAllStorybookInfo(tree);

  if (schema.onlyShowListOfCommands) {
    onlyShowGuide(allStorybookProjects);
    return;
  }
  if (!schema.noUpgrade) {
    callUpgrade(schema);
  }

  if (Object.entries(allStorybookProjects).length) {
    let migrateResult: {
      successfulProjects: {};
      failedProjects: {};
    };
    migrateResult = callAutomigrate(allStorybookProjects, schema);

    migrateResult = handleMigrationResult(migrateResult, allStorybookProjects);
    logResult(tree, migrateResult);
  }

  await formatFiles(tree);
}

export default migrate8Generator;
