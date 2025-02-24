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
  const serverFilePath = joinPathFragments(
    ...(sourceRoot ? [sourceRoot] : [projectRoot, 'src']),
    'server.ts'
  );

  tree.write(
    serverFilePath,
    `// This file should be used to export ONLY server-code from the library.`
  );

  const baseTsConfig = getRootTsConfigPathInTree(tree);
  updateJson(tree, baseTsConfig, (json) => {
    if (
      json.compilerOptions.paths &&
      json.compilerOptions.paths[options.importPath]
    ) {
      json.compilerOptions.paths[
        joinPathFragments(options.importPath, 'server')
      ] = [serverFilePath];
    }

    return json;
  });
}
