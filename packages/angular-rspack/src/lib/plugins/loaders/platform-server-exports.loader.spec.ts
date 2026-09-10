import type { LoaderContext, RawSourceMap } from '@rspack/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  default as platformServerExportsLoader,
  type PlatformServerExportsLoaderOptions,
} from './platform-server-exports.loader';

describe('platform-server-exports.loader', () => {
  const callback = vi.fn();
  const userContent = `const server = 'USER_SERVER_ENTRY';`;
  const engineWiring: NonNullable<
    PlatformServerExportsLoaderOptions['engineWiring']
  > = {
    mainServerEntry: '/root/src/main.server.ts',
    baseHref: '/app/',
    locale: 'en-US',
    inlineCriticalCss: true,
    browserOutputRelativePath: '../browser',
    indexOutputName: 'index.html',
    supportedLocales: { 'en-US': '' },
    allowedHosts: ['example.com'],
  };

  function invokeLoader(
    content: string,
    options: PlatformServerExportsLoaderOptions,
    map?: string | RawSourceMap
  ): { source: string; map: string | RawSourceMap | undefined } {
    const thisValue = {
      getOptions: () => options,
      callback,
    } as unknown as LoaderContext<PlatformServerExportsLoaderOptions>;
    platformServerExportsLoader.call(thisValue, content, map);
    return {
      source: callback.mock.calls[0][1] as string,
      map: callback.mock.calls[0][2] as string | RawSourceMap | undefined,
    };
  }

  function runLoader(
    content: string,
    options: PlatformServerExportsLoaderOptions
  ): string {
    return invokeLoader(content, options).source;
  }

  /** The number of lines the loader emitted before the original content. */
  function emittedPrefixLines(source: string): number {
    return source.slice(0, source.indexOf(userContent)).split('\n').length - 1;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should append the platform-server exports and prepend the zone.js import', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: false,
      isZoneJsInstalled: true,
    });

    expect(result.trimStart().startsWith(`import 'zone.js/node';`)).toBe(true);
    expect(result).toContain(userContent);
    expect(result).toContain(
      `export { renderApplication, renderModule, ɵSERVER_CONTEXT } from '@angular/platform-server';`
    );
    expect(result).not.toContain('@angular/ssr');
  });

  it('should not prepend the zone.js import when zone.js is not installed', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: false,
      isZoneJsInstalled: false,
    });

    expect(result).not.toContain('zone.js/node');
  });

  it('should re-export the router config helper when @angular/ssr is installed', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
    });

    expect(result).toContain(
      `export { ɵgetRoutesFromAngularRouterConfig } from '@angular/ssr';`
    );
  });

  it('should register the app and engine manifests before the user code', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring,
    });

    const appManifestIndex = result.indexOf(
      '__ngRspackSetAngularAppManifest({'
    );
    const engineManifestIndex = result.indexOf(
      '__ngRspackSetAngularAppEngineManifest({'
    );
    const staticRouteRenderIndex = result.indexOf(
      '__ngRspackAngularAppEngine.ɵallowStaticRouteRender = true;'
    );
    const userContentIndex = result.indexOf(userContent);
    expect(appManifestIndex).toBeGreaterThan(-1);
    expect(engineManifestIndex).toBeGreaterThan(-1);
    expect(staticRouteRenderIndex).toBeGreaterThan(-1);
    expect(appManifestIndex).toBeLessThan(userContentIndex);
    expect(engineManifestIndex).toBeLessThan(userContentIndex);
    expect(staticRouteRenderIndex).toBeLessThan(userContentIndex);

    expect(result).toContain(
      `bootstrap: () => Promise.resolve(__ngRspackMainServerDefault),`
    );
    expect(result).toContain(`baseHref: "/app/"`);
    expect(result).toContain(`locale: "en-US"`);
    expect(result).toContain(`inlineCriticalCss: true`);
    expect(result).toContain(
      `import __ngRspackMainServerDefault from "/root/src/main.server.ts";`
    );
    expect(result).toContain(`"../browser"`);
    expect(result).toContain(`allowedHosts: ["example.com"]`);
    expect(result).toContain(`'': () => Promise.resolve({`);
    expect(result).toMatch(
      /__ngRspackCreateServerAssets\([\s\S]*?"index\.html",\s*true\s*\)/
    );
  });

  it('should import the manifest module instead of inlining the registration when one is provided', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring: {
        ...engineWiring,
        manifestModuleRequest: '/root/__manifest__.js',
      },
    });

    const manifestImportIndex = result.indexOf(
      `import "/root/__manifest__.js";`
    );
    const userContentIndex = result.indexOf(userContent);
    expect(manifestImportIndex).toBeGreaterThan(-1);
    expect(manifestImportIndex).toBeLessThan(userContentIndex);
    expect(result).not.toContain('__ngRspackSetAngularAppManifest');
    expect(result).toContain(
      `export { default as __ngRspackMainServerBootstrap } from "/root/src/main.server.ts";`
    );
  });

  it('should disable the engine host check when the wiring requests it', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring: { ...engineWiring, disableHostCheck: true },
    });

    expect(result).toContain(
      '__ngRspackAngularAppEngine.ɵdisableAllowedHostsCheck = true;'
    );
  });

  it('should not disable the engine host check by default', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring,
    });

    expect(result).not.toContain('ɵdisableAllowedHostsCheck');
  });

  it('should trim the trailing slash from the engine manifest base path', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring,
    });

    expect(result).toContain(`basePath: "/app"`);
  });

  it('should keep a root base href as the engine manifest base path', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring: { ...engineWiring, baseHref: '/' },
    });

    expect(result).toContain(`basePath: "/"`);
  });

  it('should re-export the engine entry points and the main.server bootstrap', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: true,
      isZoneJsInstalled: true,
      engineWiring,
    });

    expect(result).toContain('ɵgetOrCreateAngularServerApp,');
    expect(result).toContain('ɵextractRoutesAndCreateRouteTree,');
    expect(result).toContain('ɵdestroyAngularServerApp,');
    expect(result).toContain(
      `export { default as __ngRspackMainServerBootstrap } from "/root/src/main.server.ts";`
    );
  });

  describe('sourcemaps', () => {
    const incomingMappings = 'AAAA,CAAC;AACD';
    const incomingMap: RawSourceMap = {
      version: 3,
      file: 'main.server.js',
      sources: ['main.server.ts'],
      names: [],
      mappings: incomingMappings,
    };
    const prefixCases: [string, PlatformServerExportsLoaderOptions][] = [
      ['nothing', { angularSSRInstalled: false, isZoneJsInstalled: false }],
      [
        'the zone.js import',
        { angularSSRInstalled: false, isZoneJsInstalled: true },
      ],
      [
        'the inlined engine manifest',
        { angularSSRInstalled: true, isZoneJsInstalled: true, engineWiring },
      ],
      [
        'the engine manifest module import',
        {
          angularSSRInstalled: true,
          isZoneJsInstalled: false,
          engineWiring: {
            ...engineWiring,
            manifestModuleRequest: '/root/__manifest__.js',
          },
        },
      ],
    ];

    it.each(prefixCases)(
      'should shift an object sourcemap past %s',
      (_, options) => {
        const { source, map } = invokeLoader(userContent, options, {
          ...incomingMap,
        });

        expect(map).toStrictEqual({
          ...incomingMap,
          mappings: `${';'.repeat(
            emittedPrefixLines(source)
          )}${incomingMappings}`,
        });
      }
    );

    it.each(prefixCases)(
      'should shift a string sourcemap past %s',
      (_, options) => {
        const { source, map } = invokeLoader(
          userContent,
          options,
          JSON.stringify(incomingMap)
        );

        expect(typeof map).toBe('string');
        expect(JSON.parse(map as string)).toStrictEqual({
          ...incomingMap,
          mappings: `${';'.repeat(
            emittedPrefixLines(source)
          )}${incomingMappings}`,
        });
      }
    );

    it('should forward a malformed sourcemap unchanged', () => {
      const { map } = invokeLoader(
        userContent,
        { angularSSRInstalled: false, isZoneJsInstalled: true },
        '{ not json'
      );

      expect(map).toBe('{ not json');
    });

    it('should forward a sourcemap rspack would reject unchanged', () => {
      const unusable = {
        version: 3,
        mappings: null,
      } as unknown as RawSourceMap;

      const { map } = invokeLoader(
        userContent,
        { angularSSRInstalled: false, isZoneJsInstalled: true },
        unusable
      );

      expect(map).toBe(unusable);
    });

    it('should pass through a missing sourcemap', () => {
      const { map } = invokeLoader(userContent, {
        angularSSRInstalled: false,
        isZoneJsInstalled: true,
      });

      expect(map).toBeUndefined();
    });
  });

  it('should not wire the engine when @angular/ssr is not installed', () => {
    const result = runLoader(userContent, {
      angularSSRInstalled: false,
      isZoneJsInstalled: true,
      engineWiring,
    });

    expect(result).not.toContain('__ngRspackSetAngularAppManifest');
    expect(result).not.toContain('__ngRspackMainServerBootstrap');
  });
});
