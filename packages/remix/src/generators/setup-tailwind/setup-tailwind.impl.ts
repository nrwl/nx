import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  installPackagesTask,
  joinPathFragments,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';

import { upsertLinksFunction } from '../../utils/upsert-links-function';
import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';
import type { SetupTailwindSchema } from './schema';

export default async function setupTailwind(
  tree: Tree,
  options: SetupTailwindSchema
) {
  const project = readProjectConfiguration(tree, options.project);
  if (project.projectType !== 'application') {
    throw new Error(
      `Project "${options.project}" is not an application. Please ensure the project is an application.`
    );
  }

  generateFiles(tree, joinPathFragments(__dirname, 'files'), project.root, {
    tpl: '',
  });

  const pathToRoot = joinPathFragments(project.root, 'app/root.tsx');
  upsertLinksFunction(
    tree,
    pathToRoot,
    'twStyles',
    './tailwind.css',
    `{ rel: "stylesheet", href: twStyles }`
  );

  addDependenciesToPackageJson(
    tree,
    {
      tailwindcss: tailwindVersion,
      postcss: postcssVersion,
      autoprefixer: autoprefixerVersion,
    },
    {}
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}
