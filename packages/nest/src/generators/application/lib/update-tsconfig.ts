import type { Tree } from '@nx/devkit';
import { joinPathFragments, updateJson } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function updateTsConfig(tree: Tree, options: NormalizedOptions): void {
  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    (json) => {
      json.compilerOptions.experimentalDecorators = true;
      json.compilerOptions.emitDecoratorMetadata = true;
      json.compilerOptions.target = 'es2021';
      if (options.strict) {
        json.compilerOptions = {
          ...json.compilerOptions,
          strictNullChecks: true,
          noImplicitAny: true,
          strictBindCallApply: true,
          forceConsistentCasingInFileNames: true,
          noFallthroughCasesInSwitch: true,
        };
      }
      return json;
    }
  );

  // For TS solution, we don't extend from shared tsconfig.json, so we need to make sure decorators are also turned on for spec tsconfig.
  if (isUsingTsSolutionSetup(tree)) {
    const tsconfigSpecPath = joinPathFragments(
      options.appProjectRoot,
      'tsconfig.spec.json'
    );
    if (tree.exists(tsconfigSpecPath)) {
      updateJson(tree, tsconfigSpecPath, (json) => {
        json.compilerOptions ??= {};
        json.compilerOptions.experimentalDecorators = true;
        json.compilerOptions.emitDecoratorMetadata = true;
        return json;
      });
    }
  }
}
