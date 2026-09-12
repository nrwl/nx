import type { Tree } from '@nx/devkit';
import { updateJson } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function updateTsConfig(tree: Tree, options: NormalizedOptions): void {
  return updateJson(
    tree,
    `${options.projectRoot}/tsconfig.lib.json`,
    (json) => {
      json.compilerOptions.target = options.target;
      // NestJS requires decorators to be enabled for dependency injection
      json.compilerOptions.experimentalDecorators = true;
      json.compilerOptions.emitDecoratorMetadata = true;

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
}
