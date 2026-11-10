import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEsmModule } from './misc-helpers';

/**
 * A compiled stylesheet in the serialized form `@angular/ssr` reads from the
 * app manifest's `criticalCssPlans`.
 */
export type CriticalCssPlan = unknown[];

export interface BeastiesCompiler {
  compileSheet(css: string, options: { href: string }): unknown;
  encodePlan(sheet: unknown): CriticalCssPlan;
}

export interface BeastiesRuntime {
  createProcessor(
    plans: CriticalCssPlan[],
    options: {
      preload: 'media-script';
      preloadFonts: boolean;
      inlineFonts: boolean;
      noscriptFallback: boolean;
      cache: boolean;
      logger: { warn: (message: string) => void };
    }
  ): { process(html: string, options: { nonce: string | undefined }): string };
}

/**
 * Loads an entry point of the beasties copy `@angular/build` (>= 22.2)
 * depends on, so the plans compiled at build time and the runtime applying
 * them during prerendering come from the same version.
 */
export function loadAngularBuildBeasties(
  entryPoint: 'compiler'
): Promise<BeastiesCompiler>;
export function loadAngularBuildBeasties(
  entryPoint: 'runtime'
): Promise<BeastiesRuntime>;
export function loadAngularBuildBeasties(
  entryPoint: 'compiler' | 'runtime'
): Promise<BeastiesCompiler | BeastiesRuntime> {
  const angularBuildDir = dirname(
    require.resolve('@angular/build/package.json')
  );
  // The entry points are ESM only.
  return loadEsmModule<BeastiesCompiler | BeastiesRuntime>(
    pathToFileURL(
      require.resolve(`beasties/${entryPoint}`, { paths: [angularBuildDir] })
    )
  );
}
