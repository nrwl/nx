import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getPackageManagerCommand,
  output,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
  workspaceRoot,
} from '@nx/devkit';
import { InitGeneratorSchema } from './schema';
import { nxVersion, playwrightVersion } from '../../utils/versions';
import { execSync } from 'child_process';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/playwright': nxVersion,
          // required since used in playwright config
          '@nx/devkit': nxVersion,
          '@playwright/test': playwrightVersion,
        }
      )
    );
  }

  if (tree.exists('.vscode/extensions.json')) {
    updateJson(tree, '.vscode/extensions.json', (json) => {
      json.recommendations ??= [];

      const recs = new Set(json.recommendations);
      recs.add('ms-playwright.playwright');

      json.recommendations = Array.from(recs);
      return json;
    });
  } else {
    tree.write(
      '.vscode/extensions.json',
      JSON.stringify(
        {
          recommendations: ['ms-playwright.playwright'],
        },
        null,
        2
      )
    );
  }

  if (process.env.NX_PCV3 === 'true') {
    addPlugin(tree);
  }

  if (!options.skipInstall) {
    tasks.push(() => {
      output.log({
        title: 'Ensuring Playwright is installed.',
        bodyLines: ['use --skipInstall to skip installation.'],
      });
      const pmc = getPackageManagerCommand();
      execSync(`${pmc.exec} playwright install`, { cwd: workspaceRoot });
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  if (
    !nxJson.plugins.some((p) =>
      typeof p === 'string'
        ? p === '@nx/playwright/plugin'
        : p.plugin === '@nx/playwright/plugin'
    )
  ) {
    nxJson.plugins.push({
      plugin: '@nx/playwright/plugin',
      options: {
        targetName: 'e2e',
      },
    });
    updateNxJson(tree, nxJson);
  }
}

export default initGenerator;
