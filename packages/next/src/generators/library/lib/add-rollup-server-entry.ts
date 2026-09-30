import {
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { NormalizedSchema } from './normalize-options';

/**
 * Adds the server entry (`src/server.ts`, or `src/server.js` with `--js`) as a
 * second Rollup entry so React Server Components are bundled separately from
 * the client entry.
 */
export function addRollupServerEntry(
  tree: Tree,
  options: NormalizedSchema
): void {
  const serverEntry = `src/server.${options.js ? 'js' : 'ts'}`;

  const rollupConfigPath = joinPathFragments(
    options.projectRoot,
    'rollup.config.cjs'
  );
  if (tree.exists(rollupConfigPath)) {
    const content = tree.read(rollupConfigPath, 'utf-8');
    const updated = content.replace(
      /^(\s*)main: .*\n/m,
      (line, indent) =>
        line + `${indent}additionalEntryPoints: ['./${serverEntry}'],\n`
    );
    if (updated === content) {
      throw new Error(
        `Could not add the server entry to ${rollupConfigPath}: "main" option not found.`
      );
    }
    tree.write(rollupConfigPath, updated);
    return;
  }

  const project = readProjectConfiguration(tree, options.projectName);
  const build = project.targets?.build;
  if (build?.executor !== '@nx/rollup:rollup') {
    throw new Error(
      `Could not add the server entry to the "build" target of "${options.projectName}": expected the @nx/rollup:rollup executor.`
    );
  }
  build.options.additionalEntryPoints = [
    joinPathFragments(options.projectRoot, serverEntry),
  ];
  updateProjectConfiguration(tree, options.projectName, project);
}
