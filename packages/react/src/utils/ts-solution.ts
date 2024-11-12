import { type Tree, updateJson } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function updateTsconfigFiles(
  tree: Tree,
  projectRoot: string,
  runtimeTsconfigFileName: string
) {
  if (!isUsingTsSolutionSetup(tree)) return;

  const tsconfigSpec = `${projectRoot}/tsconfig.spec.json`;
  const tsconfigFiles = [
    `${projectRoot}/${runtimeTsconfigFileName}`,
    tsconfigSpec,
  ];

  for (const tsconfig of tsconfigFiles) {
    if (tree.exists(tsconfig)) {
      updateJson(tree, tsconfig, (json) => {
        json.compilerOptions ??= {};
        json.compilerOptions.jsx = 'react-jsx';
        json.compilerOptions.module = 'esnext';
        json.compilerOptions.moduleResolution = 'bundler';
        return json;
      });
    }
  }

  if (tree.exists(tsconfigSpec)) {
    updateJson(tree, tsconfigSpec, (json) => {
      const runtimePath = `./${runtimeTsconfigFileName}`;
      json.references ??= [];
      if (!json.references.some((x) => x.path === runtimePath))
        json.references.push({ path: runtimePath });
      return json;
    });
  }

  if (tree.exists('tsconfig.json')) {
    updateJson(tree, 'tsconfig.json', (json) => {
      const projectPath = './' + projectRoot;
      json.references ??= [];
      if (!json.references.some((x) => x.path === projectPath))
        json.references.push({ path: projectPath });
      return json;
    });
  }
}
