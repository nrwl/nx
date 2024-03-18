import { output, ProjectConfiguration, Tree } from '@nx/devkit';
import { NormalizedSchema } from '../schema';

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
  if (
    !tree.exists('.eslintrc.json') &&
    !tree.exists('eslint.config.js') &&
    !tree.exists('.eslintrc.base.json') &&
    !tree.exists('eslint.base.config.js')
  ) {
    return;
  }
  try {
    const {
      updateRelativePathsInConfig,
      // nx-ignore-next-line
    } = require('@nx/eslint/src/generators/utils/eslint-file');
    updateRelativePathsInConfig(
      tree,
      project.root,
      schema.relativeToRootDestination
    );
  } catch {
    output.warn({
      title: `Could not update the eslint config file.`,
      bodyLines: [
        'The @nx/eslint package could not be loaded. Please update the paths in eslint config manually.',
      ],
    });
  }
}
