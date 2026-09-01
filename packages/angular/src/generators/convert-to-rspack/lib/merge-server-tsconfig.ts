import { joinPathFragments, readJson, updateJson, type Tree } from '@nx/devkit';
import { SERVER_APP_CONFIG_FILE } from '../../setup-ssr/lib/constants';

/**
 * Folds the tsconfig the server builder used into the build tsconfig. The
 * rspack build compiles the browser and the server bundles from the build
 * tsconfig, so the server sources have to stop being excluded from it, and the
 * tsconfig the removed server target used becomes dead weight.
 */
export function mergeServerTsConfig(
  tree: Tree,
  projectRoot: string,
  serverTsConfigPath: string,
  buildTsConfigPath: string | undefined
): void {
  if (!tree.exists(serverTsConfigPath)) {
    return;
  }

  const serverTsConfig = readJson(tree, serverTsConfigPath);
  const serverFiles = new Set<string>([
    ...(serverTsConfig.files ?? []),
    // excluded alongside the server entries, and reachable from them
    SERVER_APP_CONFIG_FILE,
  ]);

  if (buildTsConfigPath && tree.exists(buildTsConfigPath)) {
    updateJson(tree, buildTsConfigPath, (json) => {
      if (json.exclude) {
        json.exclude = json.exclude.filter(
          (file: string) => !serverFiles.has(file)
        );
      }

      const types = new Set<string>([
        ...(json.compilerOptions?.types ?? []),
        ...(serverTsConfig.compilerOptions?.types ?? []),
      ]);
      if (types.size) {
        json.compilerOptions ??= {};
        json.compilerOptions.types = Array.from(types);
      }

      return json;
    });
  }

  tree.delete(serverTsConfigPath);

  const projectTsConfigPath = joinPathFragments(projectRoot, 'tsconfig.json');
  if (!tree.exists(projectTsConfigPath)) {
    return;
  }

  updateJson(tree, projectTsConfigPath, (json) => {
    if (json.references) {
      json.references = json.references.filter(
        (reference: { path: string }) =>
          joinPathFragments(projectRoot, reference.path) !==
            serverTsConfigPath &&
          // setups generated before the reference path was corrected wrote it
          // relative to the workspace root
          reference.path !== serverTsConfigPath
      );
    }

    return json;
  });
}
