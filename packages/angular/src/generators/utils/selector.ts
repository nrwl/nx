import type { Tree } from '@nx/devkit';
import { names } from '@nx/devkit';

import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';

export function buildSelector(
  tree: Tree,
  name: string,
  prefix: string | undefined,
  projectPrefix: string | undefined,
  casing: keyof Pick<ReturnType<typeof names>, 'fileName' | 'propertyName'>
): string {
  let selector = name;
  prefix ??= projectPrefix ?? getNpmScope(tree);
  if (prefix) {
    selector = `${prefix}-${selector}`;
  }

  return names(selector)[casing];
}
