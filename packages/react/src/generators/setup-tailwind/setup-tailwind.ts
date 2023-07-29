import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  runTasksInSerial,
} from '@nx/devkit';

import {
  autoprefixerVersion,
  postcssVersion,
  tailwindcssVersion,
} from '../../utils/versions';
import type { SetupTailwindOptions } from './schema';
import { addTailwindStyleImports } from './lib/add-tailwind-style-imports';
import { updateProject } from './lib/update-project';

export async function setupTailwindGenerator(
  tree: Tree,
  options: SetupTailwindOptions
) {
  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(tree, options.project);

  if (
    tree.exists(joinPathFragments(project.root, 'postcss.config.js')) ||
    tree.exists(joinPathFragments(project.root, 'tailwind.config.js'))
  ) {
    logger.info(
      `Skipping setup since there are existing PostCSS or Tailwind configuration files. For manual setup instructions, see https://nx.dev/guides/using-tailwind-css-in-react.`
    );
    return;
  }

  generateFiles(tree, joinPathFragments(__dirname, './files'), project.root, {
    tmpl: '',
  });

  addTailwindStyleImports(tree, project, options);

  updateProject(tree, project, options);

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          autoprefixer: autoprefixerVersion,
          postcss: postcssVersion,
          tailwindcss: tailwindcssVersion,
        }
      )
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default setupTailwindGenerator;

export const setupTailwindSchematic = convertNxGenerator(
  setupTailwindGenerator
);
