import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const requireFn = createRequire(__filename);

/**
 * Loads a file of the installed `@angular/build` that its exports map does not
 * expose. Loading it by path shares the module instance its own tools use.
 */
export function requireAngularBuildFile(relativePath: string) {
  const angularBuildDir = dirname(
    requireFn.resolve('@angular/build/package.json')
  );
  return requireFn(join(angularBuildDir, relativePath));
}
