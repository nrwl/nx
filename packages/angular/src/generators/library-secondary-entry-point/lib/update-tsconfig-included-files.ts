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

  const entryPointPrefix = `${options.name}/`;

  updateJson(tree, tsConfigPath, (json) => {
    if (json.include?.length) {
      const newIncludes: string[] = [];
      for (const pattern of json.include) {
        if (pattern.includes('*')) {
          newIncludes.push(`${entryPointPrefix}${pattern}`);
        }
      }
      json.include = [...json.include, ...newIncludes];
    }

    if (json.exclude?.length) {
      const newExcludes: string[] = [];
      for (const pattern of json.exclude) {
        if (pattern.includes('*')) {
          newExcludes.push(`${entryPointPrefix}${pattern}`);
        }
      }
      json.exclude = [...json.exclude, ...newExcludes];
    }

    return json;
  });
}
