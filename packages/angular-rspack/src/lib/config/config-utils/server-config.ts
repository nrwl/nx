import type { SwcTranspilationTransform } from '@nx/angular-rspack-compiler';
import {
  type Configuration,
  ContextReplacementPlugin,
  DefinePlugin,
} from '@rspack/core';
import { posix, relative, resolve, sep } from 'path';
import type {
  I18nOptions,
  NormalizedAngularRspackPluginOptions,
  NormalizedDevServerOptions,
} from '../../models';
import { NgRspackPlugin } from '../../plugins/ng-rspack';
import type { AngularRspackPlugin } from '../../plugins/angular-rspack-plugin';
import type { SharedLicenseInputs } from '../../plugins/extract-licenses-plugin';
import {
  ENGINE_MANIFEST_VIRTUAL_NAME,
  generateEngineManifestSource,
  type EngineWiringOptions,
  type PlatformServerExportsLoaderOptions,
} from '../../plugins/loaders/platform-server-exports.loader';
import { EngineManifestPlugin } from '../../plugins/engine-manifest-plugin';
import { PrerenderPlugin } from '../../plugins/prerender-plugin';
import {
  getInstalledPackageVersion,
  isPackageInstalled,
} from '../../utils/misc-helpers';
import { getDevServerConfig } from './dev-server-config-utils';
import { getOptimization } from './optimization-config';
import { getSwcTranspilationRules } from './swc-transpilation';
import { isServeMode } from '../../utils/rspack-serve-env';

export async function getServerConfig(
  normalizedOptions: NormalizedAngularRspackPluginOptions,
  i18n: I18nOptions,
  defaultConfig: Configuration,
  swcTranspilationTransform: SwcTranspilationTransform,
  sharedLicenseInputs?: SharedLicenseInputs,
  sharedAngularPlugin?: AngularRspackPlugin
): Promise<Configuration> {
  const isDevServer = isServeMode();
  const { root } = normalizedOptions;

  const angularSSRInstalled = isPackageInstalled(root, '@angular/ssr');
  if (normalizedOptions.outputMode && !angularSSRInstalled) {
    throw new Error(
      'The "outputMode" option requires the "@angular/ssr" package to be installed.'
    );
  }
  if (angularSSRInstalled && i18n.shouldInline) {
    // outputMode with locale inlining is rejected during normalization, so
    // this only fires for SSR builds without an output mode.
    console.warn(
      'Locale inlining ("localize") disables the "@angular/ssr" application engine wiring: the engine manifests are not registered, so a server entry using the application engine APIs will fail at startup.'
    );
  }
  // Locale inlining is not wired up: the engine manifests would need
  // per-locale entry points, which the inlining pipeline does not produce.
  const engineWiring: EngineWiringOptions | undefined =
    angularSSRInstalled && !i18n.shouldInline
      ? {
          mainServerEntry: resolve(root, normalizedOptions.server),
          baseHref: normalizedOptions.baseHref ?? '/',
          locale: i18n.hasDefinedSourceLocale ? i18n.sourceLocale : undefined,
          inlineCriticalCss:
            !!normalizedOptions.optimization.styles.inlineCritical,
          // Baked into the emitted bundle; posix separators keep it valid
          // when the build and the server run on different platforms.
          browserOutputRelativePath: relative(
            normalizedOptions.outputPath.server,
            normalizedOptions.outputPath.browser
          )
            .split(sep)
            .join(posix.sep),
          indexOutputName: normalizedOptions.index?.output,
          supportedLocales: { [i18n.sourceLocale]: '' },
          // The engine rejects every request when its allowlist is empty, so
          // serving must allow the dev-server hosts instead of the
          // production allowlist.
          allowedHosts: isDevServer
            ? getServeModeAllowedHosts(normalizedOptions.devServer)
            : (normalizedOptions.security?.allowedHosts ?? []),
        }
      : undefined;
  let engineManifestPlugin: EngineManifestPlugin | undefined;
  // Virtual modules require rspack 1.5, probed on the workspace's own
  // @rspack/core: the copy that runs the build, which can differ from this
  // package's. Older versions inline the manifest registration into the
  // entry instead, where it only runs before the user entry's own
  // statements, not before its imports.
  if (engineWiring && installedRspackSupportsVirtualModules(root)) {
    engineWiring.manifestModuleRequest = resolve(
      root,
      ENGINE_MANIFEST_VIRTUAL_NAME
    );
    engineManifestPlugin = new EngineManifestPlugin(
      engineWiring.manifestModuleRequest,
      generateEngineManifestSource(engineWiring)
    );
  }
  const platformServerExportsLoaderOptions: PlatformServerExportsLoaderOptions =
    {
      angularSSRInstalled,
      isZoneJsInstalled: isPackageInstalled(root, 'zone.js'),
      ...(engineWiring ? { engineWiring } : {}),
    };

  return {
    ...defaultConfig,
    dependencies: ['browser'],
    name: 'server',
    target: ['node', 'es2015'],
    entry: {
      server: {
        import: [
          ...(isPackageInstalled(root, '@angular/platform-server')
            ? // This import must come before any imports (direct or transitive) that rely on DOM built-ins being
              // available, such as `@angular/elements`.
              ['@angular/platform-server/init']
            : []),
          ...(i18n.shouldInline ? ['@angular/localize/init'] : []),
          (normalizedOptions.ssr as { entry: string }).entry,
        ],
      },
    },
    output: {
      ...defaultConfig.output,
      path: normalizedOptions.outputPath.server,
      filename: '[name].js',
      chunkFilename: '[name].js',
      library: { type: 'commonjs' },
    },
    resolve: {
      ...defaultConfig.resolve,
      mainFields: ['es2020', 'es2015', 'module', 'main'],
    },
    devServer: await getDevServerConfig(normalizedOptions, 'server'),
    externals: normalizedOptions.externalDependencies,
    optimization: getOptimization(normalizedOptions, 'server'),
    module: {
      ...defaultConfig.module,
      rules: [
        ...getSwcTranspilationRules(swcTranspilationTransform),
        {
          loader:
            // oxlint-disable-next-line @nx/enforce-module-boundaries
            require.resolve('@nx/angular-rspack/loaders/platform-server-exports-loader'),
          include: [
            resolve(root, (normalizedOptions.ssr as { entry: string }).entry),
          ],
          options: platformServerExportsLoaderOptions,
        },
        ...(defaultConfig.module?.rules ?? []),
      ],
    },
    plugins: [
      ...(defaultConfig.plugins ?? []),
      ...(engineManifestPlugin ? [engineManifestPlugin] : []),
      // Fixes Critical dependency: the request of a dependency is an expression
      new ContextReplacementPlugin(/@?hapi|express[\\/]/),
      // rspack inlines `import.meta.url` as the source file's URL, breaking
      // the `isMainModule` listen gate; point it at the emitted bundle.
      new DefinePlugin({
        'import.meta.url': "require('node:url').pathToFileURL(__filename).href",
      }),
      new NgRspackPlugin(normalizedOptions, {
        i18nOptions: i18n,
        platform: 'server',
        sharedLicenseInputs,
        sharedAngularPlugin,
      }),
      ...(normalizedOptions.prerender ||
      (normalizedOptions.appShell && !isDevServer)
        ? [new PrerenderPlugin(normalizedOptions, i18n)]
        : []),
    ],
  };
}

function installedRspackSupportsVirtualModules(root: string): boolean {
  const version = getInstalledPackageVersion(root, '@rspack/core');
  if (!version) {
    return false;
  }
  const [major, minor] = version.split('.').map((part) => parseInt(part, 10));
  return major > 1 || (major === 1 && minor >= 5);
}

/**
 * The hosts the application engine accepts while serving. The forked server
 * process is browsed directly, so the engine check is the only host check on
 * the SSR dev path.
 */
function getServeModeAllowedHosts(
  devServer: NormalizedDevServerOptions
): string[] {
  const allowedHosts =
    devServer.disableHostCheck || devServer.allowedHosts === true
      ? ['*']
      : Array.isArray(devServer.allowedHosts)
        ? // The dev server matches a leading-dot entry against the apex and
          // its subdomains; the engine's '*.' form only matches subdomains,
          // so emit both.
          devServer.allowedHosts.flatMap((host) =>
            host.startsWith('.') ? [host.slice(1), `*${host}`] : [host]
          )
        : [];
  return Array.from(
    new Set([
      ...allowedHosts,
      // The engine matcher has no implicit local set; seed the hosts the dev
      // server accepts implicitly. Other IP literals cannot be enumerated;
      // NG_ALLOWED_HOSTS covers those.
      'localhost',
      '*.localhost',
      '127.0.0.1',
      '[::1]',
      devServer.host,
    ])
  );
}
