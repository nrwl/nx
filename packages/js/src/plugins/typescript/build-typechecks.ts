import type { TargetConfiguration } from '@nx/devkit';

const TYPECHECKING_EXECUTORS = new Set([
  '@nx/js:tsc',
  '@nx/angular:application',
  '@nx/angular:browser-esbuild',
  '@nx/angular:ng-packagr-lite',
  '@nx/angular:package',
  '@angular-devkit/build-angular:application',
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:browser-esbuild',
  '@angular-devkit/build-angular:ng-packagr',
  '@angular/build:application',
  '@angular/build:ng-packagr',
]);

const SKIP_TYPECHECK_EXECUTORS = new Set(['@nx/js:swc', '@nx/esbuild:esbuild']);

const TYPECHECKING_BUILD_CONFIG =
  /^(webpack|rspack|rollup)\.config\.[cm]?[jt]s$/;

/**
 * Whether the project's build already type-checks it, judged from its
 * `project.json` and `package.json` targets and, when no build executor is found, its bundler
 * config files. Options set inside a bundler config can't be read, so those
 * builds are assumed to type-check, which is their default.
 */
export function buildTypechecksProject(
  siblingFiles: string[],
  targets: Record<string, TargetConfiguration> | undefined
): boolean {
  let hasBuildExecutor = false;
  for (const { executor, options } of Object.values(targets ?? {})) {
    if (!executor) {
      continue;
    }
    if (TYPECHECKING_EXECUTORS.has(executor)) {
      return true;
    }
    if (SKIP_TYPECHECK_EXECUTORS.has(executor)) {
      hasBuildExecutor = true;
      if (options?.skipTypeCheck !== true) {
        return true;
      }
    }
  }
  if (hasBuildExecutor) {
    return false;
  }
  return siblingFiles.some((file) => TYPECHECKING_BUILD_CONFIG.test(file));
}
