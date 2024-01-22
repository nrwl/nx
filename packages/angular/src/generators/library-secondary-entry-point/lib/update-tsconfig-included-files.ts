import { joinPathFragments, updateJson, type Tree } from '@nx/devkit';
import type { NormalizedGeneratorOptions } from '../schema';

export function updateTsConfigIncludedFiles(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const candidateTsConfigPaths = [
    options.libraryProject.targets?.build?.options?.tsConfig,
    joinPathFragments(options.libraryProject.root, 'tsconfig.lib.json'),
    joinPathFragments(options.libraryProject.root, 'tsconfig.json'),
  ];

  const tsConfigPath = candidateTsConfigPaths.find(
    (path) => path && tree.exists(path)
  );
  if (!tsConfigPath) {
    // ignore if the library has a custom tsconfig setup
    return;
  }

  updateJson(tree, tsConfigPath, (json) => {
    if (json.include?.length) {
      json.include = json.include.map((path: string) =>
        path.replace(/^(?:\.\/)?src\//, '')
      );
    }

    if (json.exclude?.length) {
      json.exclude = json.exclude.map((path: string) =>
        path.replace(/^(?:\.\/)?src\//, '')
      );
    }

    return json;
  });
}
