import type { Tree } from '@nx/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { getRootTsConfigPathInTree } from '@nx/js';
import type { RemixLibraryOptions } from './normalize-options';
import { resolveImportPath } from '@nx/devkit/src/generators/project-name-and-root-utils';

export function addTsconfigEntryPoints(
  tree: Tree,
  options: RemixLibraryOptions
) {
  const { root: projectRoot, sourceRoot } = readProjectConfiguration(
    tree,
    options.projectName
  );
  const serverFilePath = joinPathFragments(sourceRoot, 'server.ts');

  tree.write(
    serverFilePath,
    `// This file should be used to export ONLY server-code from the library.`
  );

  const baseTsConfig = getRootTsConfigPathInTree(tree);
  // Use same logic as `determineProjectNameAndRootOptions` to get the import path
  const importPath = resolveImportPath(tree, options.name, projectRoot);
  updateJson(tree, baseTsConfig, (json) => {
    if (json.compilerOptions.paths && json.compilerOptions.paths[importPath]) {
      json.compilerOptions.paths[joinPathFragments(importPath, 'server')] = [
        serverFilePath,
      ];
    }

    return json;
  });
}
