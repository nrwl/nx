import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  installPackagesTask,
  joinPathFragments,
  readProjectConfiguration,
  toJS,
  type Tree,
} from '@nx/devkit';

import { upsertLinksFunction } from '../../utils/upsert-links-function';
import { tailwindVersion } from '../../utils/versions';
import { updateRemixConfig } from './lib';
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

  updateRemixConfig(tree, project.root);

  generateFiles(tree, joinPathFragments(__dirname, 'files'), project.root, {
    tpl: '',
  });

  if (options.js) {
    tree.rename(
      joinPathFragments(project.root, 'app/root.js'),
      joinPathFragments(project.root, 'app/root.tsx')
    );
  }
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
    },
    {}
  );

  if (options.js) {
    toJS(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}
