import { getDependencyVersionFromPackageJson, type Tree } from '@nx/devkit';
import { clean, coerce, major } from 'semver';

export const minSupportedViteMajorForVitest = 8;

/**
 * Nest resolves constructor dependencies from `design:paramtypes`, which only
 * exists when the transform honors `emitDecoratorMetadata`. Vite < 8 transforms
 * TypeScript with esbuild, which drops it, so the injector sees no dependencies
 * and every generated spec that injects a provider fails. Vite 8's oxc transform
 * emits it.
 */
export function assertVitestSupported(tree: Tree): void {
  const declaredVersion = getDependencyVersionFromPackageJson(tree, 'vite');
  if (!declaredVersion) {
    // Vite isn't installed yet, so @nx/vitest will install a supported major.
    return;
  }

  const version = clean(declaredVersion) ?? coerce(declaredVersion)?.version;
  // An unparseable range (workspace:, catalog:, a git url) isn't evidence of an
  // unsupported version, so don't block on it.
  if (!version || major(version) >= minSupportedViteMajorForVitest) {
    return;
  }

  throw new Error(
    `Using vitest with @nx/nest requires Vite ${minSupportedViteMajorForVitest} or later, but found Vite ${version}.\n` +
      `Nest dependency injection needs "emitDecoratorMetadata", which the esbuild transform used by Vite < ${minSupportedViteMajorForVitest} does not emit.\n` +
      `Upgrade Vite, or generate with "--unitTestRunner=jest".`
  );
}
