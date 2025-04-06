import { joinPathFragments, readJson, Tree, writeJson } from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';

export function updateTsconfig(tree: Tree, projectRoot: string) {
  const tsconfigPath = joinPathFragments(projectRoot, 'tsconfig.json');
  const tsconfig = readJson(tree, tsconfigPath);

  tsconfig['ts-node'] ??= {};
  tsconfig['ts-node'].compilerOptions ??= {};
  tsconfig['ts-node'].compilerOptions.module = 'CommonJS';
  tsconfig['ts-node'].compilerOptions.moduleResolution = 'Node10';

  if (tsconfig.compilerOptions?.customConditions) {
    tsconfig['ts-node'].compilerOptions.customConditions = null;
  } else {
    const rootTsconfigFile = getRootTsConfigFileName(tree);
    if (rootTsconfigFile) {
      const rootTsconfigJson = readJson(tree, rootTsconfigFile);
      if (rootTsconfigJson.compilerOptions?.customConditions) {
        tsconfig['ts-node'].compilerOptions.customConditions = null;
      }
    }
  }

  writeJson(tree, tsconfigPath, tsconfig);
}
