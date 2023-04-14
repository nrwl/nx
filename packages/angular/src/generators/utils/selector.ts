import type { Tree } from '@nx/devkit';
import { names, readNxJson } from '@nx/devkit';

export function buildSelector(
  tree: Tree,
  name: string,
  prefix: string | undefined,
  projectPrefix: string | undefined,
  casing: keyof Pick<ReturnType<typeof names>, 'fileName' | 'propertyName'>
): string {
  let selector = name;
  prefix ??= projectPrefix ?? readNxJson(tree)?.npmScope;
  if (prefix) {
    selector = `${prefix}-${selector}`;
  }

  return names(selector)[casing];
}
