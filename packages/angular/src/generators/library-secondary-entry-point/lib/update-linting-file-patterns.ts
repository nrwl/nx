import { Tree, updateProjectConfiguration } from '@nrwl/devkit';
import { NormalizedGeneratorOptions } from '../schema';

export function updateLintingFilePatterns(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const { libraryProject } = options;

  if (libraryProject.targets?.lint?.options?.lintFilePatterns) {
    libraryProject.targets.lint.options.lintFilePatterns.push(
      ...[
        `${libraryProject.root}/${options.name}/**/*.ts`,
        `${libraryProject.root}/${options.name}/**/*.html`,
      ]
    );

    updateProjectConfiguration(tree, options.library, libraryProject);
  }
}
