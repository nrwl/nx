import type { Tree } from '@nx/devkit';
import { joinPathFragments, updateJson } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';
import {
  getTsConfigModuleResolution,
  isUsingTsSolutionSetup,
} from '@nx/js/internal';

export function updateTsConfig(tree: Tree, options: NormalizedOptions): void {
  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    (json) => {
      json.compilerOptions.experimentalDecorators = true;
      json.compilerOptions.emitDecoratorMetadata = true;
      json.compilerOptions.target = 'es2021';

      // TS solution setup uses 'nodenext'; otherwise pin a version-appropriate
      // node-family/bundler resolution for this commonjs context.
      if (!isUsingTsSolutionSetup(tree)) {
        json.compilerOptions.moduleResolution =
          getTsConfigModuleResolution(tree);
      }
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
