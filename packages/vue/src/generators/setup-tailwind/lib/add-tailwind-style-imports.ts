import { joinPathFragments, ProjectConfiguration, Tree } from '@nx/devkit';

import { SetupTailwindOptions } from '../schema';

const knownStylesheetLocations = [
  // What we generate by default
  'src/styles.css',
  'src/styles.scss',
  'src/styles.less',

  // What we generate for nuxt by default
  'src/assets/css/styles.css',
  'src/assets/css/styles.scss',
  'src/assets/css/styles.less',

  // Other common locations (e.g. what `npm create vue` does)
  'src/assets/styles.css',
  'src/assets/styles.scss',
  'src/assets/styles.less',
];

export function addTailwindStyleImports(
  tree: Tree,
  project: ProjectConfiguration,
  _options: SetupTailwindOptions
) {
  if (_options.stylesheet) {
    knownStylesheetLocations.push(_options.stylesheet);
  }

  const stylesPath = knownStylesheetLocations
    .map((file) => joinPathFragments(project.root, file))
    .find((file) => tree.exists(file));

  if (!stylesPath) {
    throw new Error(
      `Could not find the stylesheet to update. Use --stylesheet to specify this path (relative to the workspace root).`
    );
  }

  const content = tree.read(stylesPath).toString();
  tree.write(
    stylesPath,
    `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${content}`
  );
}
