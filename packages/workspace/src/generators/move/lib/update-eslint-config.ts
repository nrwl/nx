import { ensurePackage, ProjectConfiguration, Tree } from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

/**
 * Update the .eslintrc file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateEslintConfig(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  // if there is no suitable eslint config, we don't need to do anything
  if (!tree.exists('.eslintrc.json') && !tree.exists('eslint.config.js')) {
    return;
  }
  ensurePackage('@nx/linter', nxVersion);
  const {
    updateRelativePathsInConfig,
    // nx-ignore-next-line
  } = require('@nx/linter/src/generators/utils/eslint-file');
  updateRelativePathsInConfig(
    tree,
    project.root,
    schema.relativeToRootDestination
  );
}
