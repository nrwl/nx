import {
  type LoaderContext,
  type LoaderDefinitionFunction,
} from '@rspack/core';
import {
  generateEngineManifestSource,
  type EngineWiringOptions,
} from './engine-manifest';
import { isForwardableSourceMap } from './inline-source-map';

type LoaderSourceMap = Parameters<LoaderDefinitionFunction>[1];

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
  map: LoaderSourceMap
) {
  const { angularSSRInstalled, isZoneJsInstalled, engineWiring } =
    this.getOptions();

  let prologue: string | undefined;
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

  const prefix = [
    isZoneJsInstalled ? `import 'zone.js/node';` : undefined,
    prologue,
  ]
    .filter((section) => section !== undefined)
    .map((section) => `${section}\n`)
    .join('');

  this.callback(
    null,
    `${prefix}${content}\n${epilogue}`,
    shiftSourceMap(map, prefix)
  );

  return;
}

/**
 * Moves every mapping down by the number of lines emitted before the original
 * content. Source Map v3 `mappings` holds one `;`-separated group per
 * generated line, so leading empty groups shift the lines and leave the
 * columns untouched. A map that cannot be parsed or that rspack would reject
 * is forwarded as it arrived.
 */
function shiftSourceMap(map: LoaderSourceMap, prefix: string): LoaderSourceMap {
  const lineCount = prefix.split('\n').length - 1;
  if (map === undefined || lineCount === 0) {
    return map;
  }

  let parsed: unknown = map;
  if (typeof map === 'string') {
    try {
      parsed = JSON.parse(map);
    } catch {
      return map;
    }
  }

  if (!isForwardableSourceMap(parsed)) {
    return map;
  }

  const shifted = {
    ...parsed,
    mappings: `${';'.repeat(lineCount)}${parsed.mappings}`,
  };

  return typeof map === 'string' ? JSON.stringify(shifted) : shifted;
}
