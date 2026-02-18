import {
  addDependenciesToPackageJson,
  formatFiles,
  generateFiles,
  installPackagesTask,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  stripIndents,
  type Tree,
} from '@nx/devkit';

import {
  autoprefixerVersion,
  postcssVersion,
  tailwindVersion,
} from '../../utils/versions';
import type { SetupTailwindSchema } from './schema';
import { insertStatementAfterImports } from '../../utils/insert-statement-after-imports';

export default async function setupTailwind(
  tree: Tree,
  options: SetupTailwindSchema
) {
  logger.warn(
    `The 'setup-tailwind' generator is deprecated. Generating Tailwind configuration is no longer maintained. This generator will be removed in Nx 23.`
  );

  const project = readProjectConfiguration(tree, options.project);

  generateFiles(tree, joinPathFragments(__dirname, 'files'), project.root, {
    tpl: '',
  });

  const pathToRoot = joinPathFragments(project.root, 'app/root.tsx');

  insertStatementAfterImports(
    tree,
    pathToRoot,
    stripIndents`import './tailwind.css';`
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
