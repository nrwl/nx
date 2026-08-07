import type { LoaderContext } from '@rspack/core';
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

  function runLoader(
    content: string,
    options: PlatformServerExportsLoaderOptions
  ): string {
    const thisValue = {
      getOptions: () => options,
      callback,
    } as unknown as LoaderContext<PlatformServerExportsLoaderOptions>;
    platformServerExportsLoader.call(thisValue, content, undefined);
    return callback.mock.calls[0][1] as string;
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
