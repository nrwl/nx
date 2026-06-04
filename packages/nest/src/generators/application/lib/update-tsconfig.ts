import type { Tree } from '@nx/devkit';
import { joinPathFragments, updateJson } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';
import {
  isTypescriptVersionAtLeast,
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

      // Only set this when not using TS solution setup, as TS solution setup uses 'nodenext'.
      // This is a commonjs context, so 'bundler' is invalid on TS<6 (TS5095) and 'node' is a
      // deprecation error on TS>=6 (TS5107); branch to a valid value for the declared TS version.
      if (!isUsingTsSolutionSetup(tree)) {
        json.compilerOptions.moduleResolution = isTypescriptVersionAtLeast(
          tree,
          '6.0.0'
        )
          ? 'bundler'
          : 'node10';
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
