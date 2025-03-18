import { joinPathFragments, readJson, Tree, writeJson } from '@nx/devkit';

export function updateTsconfig(tree: Tree, projectRoot: string) {
  const tsconfigPath = joinPathFragments(projectRoot, 'tsconfig.json');
  const tsconfig = readJson(tree, tsconfigPath);
  tsconfig['ts-node'] = {
    compilerOptions: {
      module: 'CommonJS',
    },
  };
  writeJson(tree, tsconfigPath, tsconfig);
}
