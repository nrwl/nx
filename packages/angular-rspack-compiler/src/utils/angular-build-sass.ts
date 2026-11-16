import { requireAngularBuildFile } from './angular-build-file';

interface SassLanguageModule {
  shutdownSassWorkerPool(): void;
  // Added in @angular/build 22.2.
  resetSassWorkerPoolCaches?: () => void;
}

function loadSassLanguage(): SassLanguageModule {
  return requireAngularBuildFile(
    'src/tools/esbuild/stylesheets/sass-language.js'
  );
}

/**
 * Stops the Sass compiler `@angular/build` keeps for component stylesheets.
 * From 22.2 it runs Dart Sass in a child process, which keeps a one-shot build
 * from exiting until stopped.
 */
export function shutdownAngularBuildSass(): void {
  loadSassLanguage().shutdownSassWorkerPool();
}

/**
 * `@angular/build` >= 22.2 keeps the directory listings Sass imports resolve
 * from across compilations, so a stylesheet change must drop them for added or
 * removed files to resolve.
 */
export function resetAngularBuildSassCaches(changedFiles: Set<string>): void {
  const { resetSassWorkerPoolCaches } = loadSassLanguage();
  if (
    resetSassWorkerPoolCaches &&
    [...changedFiles].some((file) => /\.(scss|sass|css)$/i.test(file))
  ) {
    resetSassWorkerPoolCaches();
  }
}
