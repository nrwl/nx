import {
  type LoaderContext,
  type LoaderDefinitionFunction,
} from '@rspack/core';
import { join } from 'node:path';

export interface PlatformServerExportsLoaderOptions {
  angularSSRInstalled: boolean;
  isZoneJsInstalled: boolean;
  /**
   * Wiring for the `@angular/ssr` application engine APIs. When set, the SSR
   * entry registers the app and engine manifests before any user statement
   * runs and re-exports the engine entry points, mirroring the virtual
   * manifest modules the esbuild application builder injects. Without the
   * manifests, `AngularAppEngine` and `AngularServerApp` throw at
   * construction, so a server entry written against those APIs crashes at
   * startup.
   */
  engineWiring?: {
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
  };
}

export default function loader(
  this: LoaderContext<PlatformServerExportsLoaderOptions>,
  content: string,
  map: Parameters<LoaderDefinitionFunction>[1]
) {
  const { angularSSRInstalled, isZoneJsInstalled, engineWiring } =
    this.getOptions();

  let prologue = '';
  let epilogue = `
  // EXPORTS added by @nx/angular-rspack
  export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';
  `;

  if (angularSSRInstalled) {
    epilogue += `
      export { ɵgetRoutesFromAngularRouterConfig } from '@angular/ssr';
    `;
  }

  if (angularSSRInstalled && engineWiring) {
    const mainServerRequest = JSON.stringify(engineWiring.mainServerEntry);
    // The assets helper is bundled into the server output, keeping it off the
    // package's public API surface. rspack resolves the extension.
    const serverAssetsRequest = JSON.stringify(
      join(__dirname, '../../ssr/server-assets')
    );
    // The engine matches basePath against URL pathnames verbatim, so it must
    // not keep the base HREF's trailing slash.
    let basePath = engineWiring.baseHref || '/';
    if (basePath.length > 1 && basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }

    prologue = `
    import __ngRspackMainServerDefault from ${mainServerRequest};
    import {
      ɵsetAngularAppManifest as __ngRspackSetAngularAppManifest,
      ɵsetAngularAppEngineManifest as __ngRspackSetAngularAppEngineManifest,
      ɵgetOrCreateAngularServerApp as __ngRspackGetOrCreateAngularServerApp,
      ɵdestroyAngularServerApp as __ngRspackDestroyAngularServerApp,
    } from '@angular/ssr';
    import { createBrowserOutputServerAssets as __ngRspackCreateServerAssets } from ${serverAssetsRequest};
    import { join as __ngRspackJoinPath } from 'node:path';
    // MANIFESTS added by @nx/angular-rspack: registered before any user
    // statement so an application engine constructed in module scope finds
    // them.
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
    `;
    epilogue += `
      export {
        ɵgetOrCreateAngularServerApp,
        ɵextractRoutesAndCreateRouteTree,
        ɵdestroyAngularServerApp,
      } from '@angular/ssr';
      export { default as ɵmainServerBootstrap } from ${mainServerRequest};
    `;
  }

  let source = `${prologue}
${content}
${epilogue}`;

  if (isZoneJsInstalled) {
    source = `import 'zone.js/node';
    ${source}`;
  }

  this.callback(null, source, map);

  return;
}
