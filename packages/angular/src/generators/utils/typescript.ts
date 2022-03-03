import { Tree } from '@nrwl/devkit';

export function getRootTsConfigPath(tree: Tree): string {
  for (const path of ['tsconfig.base.json', 'tsconfig.json']) {
    if (tree.exists(path)) {
      return path;
    }
  }

  throw new Error(
    'Could not find root tsconfig file. Tried with "tsconfig.base.json" and "tsconfig.json".'
  );
}
