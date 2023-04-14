import type { Tree } from '@nx/devkit';
import { joinPathFragments, updateJson } from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function updateTsConfig(tree: Tree, options: NormalizedOptions): void {
  updateJson(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    (json) => {
      json.compilerOptions.emitDecoratorMetadata = true;
      json.compilerOptions.target = 'es2015';
      return json;
    }
  );
}
