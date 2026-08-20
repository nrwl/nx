import {
  type LoaderContext,
  type LoaderDefinitionFunction,
} from '@rspack/core';
import {
  generateEngineManifestSource,
  type EngineWiringOptions,
} from './engine-manifest';

export interface PlatformServerExportsLoaderOptions {
  angularSSRInstalled: boolean;
  isZoneJsInstalled: boolean;
  /**
   * Wiring for the `@angular/ssr` application engine APIs. When set, the SSR
   * entry registers the app and engine manifests and re-exports the engine
   * entry points, mirroring the manifests the esbuild application builder
   * injects. Without the manifests, `AngularAppEngine` and
   * `AngularServerApp` throw at construction, so a server entry written
   * against those APIs crashes at startup.
   */
  engineWiring?: EngineWiringOptions;
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
    prologue = engineWiring.manifestModuleRequest
      ? // A separate module evaluates before the user entry's own imports, so
        // an engine constructed in an imported module's scope finds the
        // manifests.
        `import ${JSON.stringify(engineWiring.manifestModuleRequest)};`
      : generateEngineManifestSource(engineWiring);
    epilogue += `
      export {
        ɵgetOrCreateAngularServerApp,
        ɵextractRoutesAndCreateRouteTree,
        ɵdestroyAngularServerApp,
      } from '@angular/ssr';
      export { default as __ngRspackMainServerBootstrap } from ${JSON.stringify(
        engineWiring.mainServerEntry
      )};
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
