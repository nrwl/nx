import {
  joinPathFragments,
  logger,
  ProjectConfiguration,
  stripIndents,
  Tree,
} from '@nx/devkit';

import { SetupTailwindOptions } from '../schema';

// base directories and file types to simplify locating the stylesheet
const baseDirs = ['src', 'pages', 'src/pages', 'src/app', 'app'];
const fileNames = ['styles', 'global'];
const extensions = ['.css', '.scss', '.less'];

const knownLocations = baseDirs.flatMap((dir) =>
  fileNames.flatMap((name) => extensions.map((ext) => `${dir}/${name}${ext}`))
);

export function addTailwindStyleImports(
  tree: Tree,
  project: ProjectConfiguration,
  _options: SetupTailwindOptions
) {
  const candidates = knownLocations.map((currentPath) =>
    joinPathFragments(project.root, currentPath)
  );
  const stylesPath = candidates.find((currentStylePath) =>
    tree.exists(currentStylePath)
  );

  if (stylesPath) {
    const content = tree.read(stylesPath).toString();
    tree.write(
      stylesPath,
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${content}`
    );
  } else {
    logger.warn(
      stripIndents`
        Could not find stylesheet to update. Add the following imports to your stylesheet (e.g. styles.css):
        
          @tailwind base;
          @tailwind components;
          @tailwind utilities;
          
        See our guide for more details: https://nx.dev/guides/using-tailwind-css-in-react`
    );
  }
}
