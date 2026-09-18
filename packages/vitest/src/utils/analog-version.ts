import { readJson, Tree } from '@nx/devkit';
import { coerce, major } from 'semver';

/**
 * Detect the installed AnalogJS major version from package.json.
 * Returns 3 if @analogjs/vitest-angular >=3.0.0 is installed,
 * otherwise returns 2 (the default/stable channel).
 */
export function getAnalogMajorVersion(tree: Tree): 2 | 3 {
  const pkgJson = readJson(tree, 'package.json');
  const installed =
    pkgJson.devDependencies?.['@analogjs/vitest-angular'] ??
    pkgJson.dependencies?.['@analogjs/vitest-angular'];
  if (!installed) {
    return 2;
  }
  const coerced = coerce(installed);
  if (!coerced) {
    return 2;
  }
  return major(coerced) >= 3 ? 3 : 2;
}
