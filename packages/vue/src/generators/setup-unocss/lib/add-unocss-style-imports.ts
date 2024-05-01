import { joinPathFragments, ProjectConfiguration, Tree } from '@nx/devkit';

import { SetupUnoCSSOptions } from '../schema';

const knownEntrypointLocations = [
  // What we generate by default
  'src/main.ts',
  'src/main.js',
]

export function addUnoCSSStyleImports(
  tree: Tree,
  project: ProjectConfiguration,
  _options: SetupUnoCSSOptions
) {
  if (_options.entrypoint) {
    knownEntrypointLocations.push(_options.entrypoint);
  }

  const entrypointPath = knownEntrypointLocations
  .map((file) => joinPathFragments(project.root, file))
  .find((file) => tree.exists(file));

  if (!entrypointPath) {
    throw new Error(
      `Could not find the entrypoint to update. Use --entrypoint to specify this path (relative to the workspace root).`
    );
  }

  const content = tree.read(entrypointPath).toString();
  tree.write(
    entrypointPath,
    `import 'virtual:uno.css';\n${content}`
  );

}
