import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { InitGeneratorSchema } from './schema';
import { nxVersion, playwrightVersion } from '../../utils/versions';

export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/playwright': nxVersion,
          '@playwright/test': playwrightVersion,
        }
      )
    );
  }
  if (!options.skipFormat) {
    await formatFiles(tree);
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

  return runTasksInSerial(...tasks);
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
