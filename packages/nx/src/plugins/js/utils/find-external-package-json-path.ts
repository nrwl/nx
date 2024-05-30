import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * In many cases the package.json will be directly resolvable, so we try that first.
 * If, however, package exports are used and the package.json is not defined, we will
 * need to resolve the main entry point of the package and traverse upwards to find the
 * package.json.
 *
 * NOTE: Unit testing this code is currently impractical as it is not possible to mock
 * require.resolve in jest https://github.com/jestjs/jest/issues/9543
 */
export function findExternalPackageJsonPath(
  packageName: string,
  relativeToDir: string
): string | null {
  try {
    return require.resolve(join(packageName, 'package.json'), {
      paths: [relativeToDir],
    });
  } catch {
    try {
      // Resolve the main entry point of the package
      const mainPath = require.resolve(packageName, {
        paths: [relativeToDir],
      });
      let dir = dirname(mainPath);

      while (dir !== parse(dir).root) {
        const packageJsonPath = join(dir, 'package.json');
        if (existsSync(packageJsonPath)) {
          return packageJsonPath;
        }
        dir = dirname(dir);
      }

      throw new Error(`Could not find package.json for ${packageName}`);
    } catch {
      return null;
    }
  }
}
