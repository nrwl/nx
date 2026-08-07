import { join } from 'node:path';

/**
 * File name of the virtual module carrying the engine manifest registration.
 * The angular-partial-transform loader must skip it by name: its source
 * mentions `@angular` but there is no on-disk file for the transformer
 * worker to read.
 */
export const ENGINE_MANIFEST_VIRTUAL_NAME =
  '__ng-rspack-ssr-entry-manifest__.js';

export interface EngineWiringOptions {
  /** Absolute path to the application's `main.server` entry. */
  mainServerEntry: string;
  baseHref: string;
  locale: string | undefined;
  inlineCriticalCss: boolean;
  /** Path from the server output directory to the browser output. */
  browserOutputRelativePath: string;
  /** File name of the emitted index html within the browser output. */
  indexOutputName: string | undefined;
  supportedLocales: Record<string, string>;
  allowedHosts: string[];
  /**
   * Absolute path of the virtual module carrying the manifest registration.
   * When set, the loader imports it instead of inlining the registration
   * statements, so they run before the user entry's own imports evaluate.
   * Absent when the installed rspack has no virtual modules support
   * (< 1.5.0); the inlined statements then only run before the user entry's
   * own statements.
   */
  manifestModuleRequest?: string;
}

/**
 * The module source registering the app and engine manifests. Emitted either
 * as a virtual module the SSR entry imports first or inlined into the entry
 * by the loader, depending on `manifestModuleRequest`.
 */
export function generateEngineManifestSource(
  engineWiring: EngineWiringOptions
): string {
  const mainServerRequest = JSON.stringify(engineWiring.mainServerEntry);
  // The assets helper is bundled into the server output, keeping it off the
  // package's public API surface. rspack resolves the extension.
  const serverAssetsRequest = JSON.stringify(
    join(__dirname, '../../ssr/server-assets')
  );
  // The engine compares basePath against URL pathnames verbatim, but only in
  // multi-locale setups; trim the trailing slash to match the base path the
  // esbuild application builder emits.
  let basePath = engineWiring.baseHref || '/';
  if (basePath.length > 1 && basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }

  return `
  import __ngRspackMainServerDefault from ${mainServerRequest};
  import {
    AngularAppEngine as __ngRspackAngularAppEngine,
    ɵsetAngularAppManifest as __ngRspackSetAngularAppManifest,
    ɵsetAngularAppEngineManifest as __ngRspackSetAngularAppEngineManifest,
    ɵgetOrCreateAngularServerApp as __ngRspackGetOrCreateAngularServerApp,
    ɵdestroyAngularServerApp as __ngRspackDestroyAngularServerApp,
  } from '@angular/ssr';
  import { createBrowserOutputServerAssets as __ngRspackCreateServerAssets } from ${serverAssetsRequest};
  import { join as __ngRspackJoinPath } from 'node:path';
  // MANIFESTS added by @nx/angular-rspack: an application engine cannot
  // construct without them.
  __ngRspackSetAngularAppManifest({
    bootstrap: () => Promise.resolve(__ngRspackMainServerDefault),
    inlineCriticalCss: ${JSON.stringify(engineWiring.inlineCriticalCss)},
    baseHref: ${JSON.stringify(engineWiring.baseHref)},
    locale: ${JSON.stringify(engineWiring.locale)},
    assets: __ngRspackCreateServerAssets(
      __ngRspackJoinPath(__dirname, ${JSON.stringify(
        engineWiring.browserOutputRelativePath
      )}),
      ${JSON.stringify(engineWiring.indexOutputName)},
      ${JSON.stringify(engineWiring.inlineCriticalCss)}
    ),
  });
  __ngRspackSetAngularAppEngineManifest({
    basePath: ${JSON.stringify(basePath)},
    supportedLocales: ${JSON.stringify(engineWiring.supportedLocales)},
    allowedHosts: ${JSON.stringify(engineWiring.allowedHosts)},
    // The bundle already contains the application and the manifest set
    // above, so the entry point resolves in place instead of importing a
    // separate main.server bundle.
    entryPoints: {
      '': () => Promise.resolve({
        ɵgetOrCreateAngularServerApp: __ngRspackGetOrCreateAngularServerApp,
        ɵdestroyAngularServerApp: __ngRspackDestroyAngularServerApp,
      }),
    },
  });
  // Build-time prerendering is not wired up; without this flag the engine
  // refuses to render prerender-marked routes at request time, which 404s
  // every route under the default server route configuration.
  __ngRspackAngularAppEngine.ɵallowStaticRouteRender = true;
  `;
}
