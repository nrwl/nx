import type { DevServer } from '@rspack/core';
import assert from 'node:assert';
import { existsSync, promises as fsPromises } from 'node:fs';
import { extname, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { NormalizedAngularRspackPluginOptions } from '../../models';
import { getIndexOutputFile } from '../../utils/index-file/get-index-output-file';
import { loadEsmModule } from '../../utils/misc-helpers';

export async function getDevServerConfig(
  options: NormalizedAngularRspackPluginOptions,
  platform: 'browser' | 'server'
): Promise<DevServer> {
  const { root } = options;

  const servePath = buildServePath(options);

  return {
    host: options.devServer.host,
    port: options.devServer.port,
    headers: {
      'Access-Control-Allow-Origin': '*',
      ...options.devServer.headers,
    },
    historyApiFallback: {
      index: posix.join(servePath, getIndexOutputFile(options.index)),
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
      rewrites: [
        {
          from: new RegExp(`^(?!${servePath})/.*`),
          to: (context) => context.parsedUrl.href,
        },
      ],
    },
    compress: false,
    static: false,
    server: getServerConfig(options),
    allowedHosts: getAllowedHostsConfig(
      options.devServer.allowedHosts,
      options.devServer.disableHostCheck
    ),
    devMiddleware: {
      publicPath: servePath,
      writeToDisk:
        platform === 'browser' && options.hasServer
          ? (file) => !file.includes('.hot-update.')
          : undefined,
    },
    liveReload: options.devServer.liveReload,
    hot:
      options.devServer.hmr && !options.devServer.liveReload
        ? 'only'
        : options.devServer.hmr,
    proxy: await getProxyConfig(root, options.devServer.proxyConfig),
    ...getWebSocketSettings(options, servePath),
    watchFiles: ['./src/**/*.*', './public/**/*.*'],
    onListening:
      platform === 'browser'
        ? (devServer) => {
            if (!devServer) {
              throw new Error('@rspack/dev-server is not defined');
            }

            const port =
              (devServer.server?.address() as { port: number })?.port ??
              options.devServer.port;
            console.log('Listening on port:', port);
          }
        : undefined,
  };
}

/**
 * Resolve and build a URL _path_ that will be the root of the server. This resolves base href and
 * deploy URL from the browser options and returns a path from the root.
 */
function buildServePath(options: NormalizedAngularRspackPluginOptions): string {
  let servePath = options.devServer.servePath;

  if (servePath === undefined) {
    const defaultPath = findDefaultServePath(
      options.baseHref,
      options.deployUrl
    );
    if (defaultPath == null) {
      console.warn(
        `Warning: --deploy-url and/or --base-href contain unsupported values for ng serve. Default serve path of '/' used. Use --serve-path to override.`
      );
    }
    servePath = defaultPath || '';
  }

  if (servePath.endsWith('/')) {
    servePath = servePath.slice(0, -1);
  }

  if (!servePath.startsWith('/')) {
    servePath = `/${servePath}`;
  }

  return servePath;
}

/**
 * Find the default server path. We don't want to expose baseHref and deployUrl as arguments, only
 * the browser options where needed.
 */
function findDefaultServePath(
  baseHref?: string,
  deployUrl?: string
): string | null {
  if (!baseHref && !deployUrl) {
    return '';
  }

  if (
    /^(\w+:)?\/\//.test(baseHref || '') ||
    /^(\w+:)?\/\//.test(deployUrl || '')
  ) {
    // If baseHref or deployUrl is absolute, unsupported by ng serve
    return null;
  }

  // normalize baseHref
  // for ng serve the starting base is always `/` so a relative
  // and root relative value are identical
  const baseHrefParts = (baseHref || '')
    .split('/')
    .filter((part) => part !== '');
  if (baseHref && !baseHref.endsWith('/')) {
    baseHrefParts.pop();
  }
  const normalizedBaseHref =
    baseHrefParts.length === 0 ? '/' : `/${baseHrefParts.join('/')}/`;

  if (deployUrl && deployUrl[0] === '/') {
    if (baseHref && baseHref[0] === '/' && normalizedBaseHref !== deployUrl) {
      // If baseHref and deployUrl are root relative and not equivalent, unsupported by ng serve
      return null;
    }

    return deployUrl;
  }

  // Join together baseHref and deployUrl
  return `${normalizedBaseHref}${deployUrl || ''}`;
}

function getServerConfig(
  options: NormalizedAngularRspackPluginOptions
): DevServer['server'] {
  const {
    root,
    devServer: { ssl, sslCert, sslKey },
  } = options;

  if (!ssl) {
    return 'http';
  }

  return {
    type: 'https',
    options:
      sslCert && sslKey
        ? {
            key: resolve(root, sslKey),
            cert: resolve(root, sslCert),
          }
        : undefined,
  };
}

function getAllowedHostsConfig(
  allowedHosts: string[] | boolean | undefined,
  disableHostCheck: boolean | undefined
) {
  if (disableHostCheck || allowedHosts === true) {
    return 'all';
  }
  if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
    return allowedHosts;
  }

  return undefined;
}

async function getProxyConfig(
  root: string,
  proxyConfig: string | undefined
): Promise<DevServer['proxy'] | undefined> {
  if (!proxyConfig) {
    return undefined;
  }

  const proxyPath = resolve(root, proxyConfig);

  if (!existsSync(proxyPath)) {
    throw new Error(`Proxy configuration file ${proxyPath} does not exist.`);
  }

  let proxyConfiguration: Record<string, object> | object[];

  switch (extname(proxyPath)) {
    case '.json': {
      const content = await fsPromises.readFile(proxyPath, 'utf-8');

      const { parse, printParseErrorCode } = await import('jsonc-parser');
      const parseErrors: import('jsonc-parser').ParseError[] = [];
      proxyConfiguration = parse(content, parseErrors, {
        allowTrailingComma: true,
      });

      if (parseErrors.length > 0) {
        let errorMessage = `Proxy configuration file ${proxyPath} contains parse errors:`;
        for (const parseError of parseErrors) {
          const { line, column } = getJsonErrorLineColumn(
            parseError.offset,
            content
          );
          errorMessage += `\n[${line}, ${column}] ${printParseErrorCode(
            parseError.error
          )}`;
        }
        throw new Error(errorMessage);
      }

      break;
    }
    case '.mjs':
      // Load the ESM configuration file using the TypeScript dynamic import workaround.
      // Once TypeScript provides support for keeping the dynamic import this workaround can be
      // changed to a direct dynamic import.
      proxyConfiguration = (
        await loadEsmModule<{ default: Record<string, object> | object[] }>(
          pathToFileURL(proxyPath)
        )
      ).default;
      break;
    case '.cjs':
      proxyConfiguration = require(proxyPath);
      break;
    default:
      // The file could be either CommonJS or ESM.
      // CommonJS is tried first then ESM if loading fails.
      try {
        proxyConfiguration = require(proxyPath);
      } catch (e) {
        assertIsError(e);
        if (
          e.code !== 'ERR_REQUIRE_ESM' &&
          e.code !== 'ERR_REQUIRE_ASYNC_MODULE'
        ) {
          throw e;
        }

        // Load the ESM configuration file using the TypeScript dynamic import workaround.
        // Once TypeScript provides support for keeping the dynamic import this workaround can be
        // changed to a direct dynamic import.
        proxyConfiguration = (
          await loadEsmModule<{ default: Record<string, object> | object[] }>(
            pathToFileURL(proxyPath)
          )
        ).default;
      }
  }

  return normalizeProxyConfiguration(proxyConfiguration);
}

function getWebSocketSettings(
  options: NormalizedAngularRspackPluginOptions,
  servePath: string
): {
  webSocketServer?: DevServer['webSocketServer'];
  client?: DevServer['client'];
} {
  const { hmr, liveReload } = options.devServer;
  if (!hmr && !liveReload) {
    return { client: undefined, webSocketServer: false };
  }

  const webSocketPath = posix.join(servePath, 'ng-cli-ws');

  return {
    webSocketServer: {
      options: { path: webSocketPath },
    },
    client: {
      logging: 'info',
      webSocketURL: getPublicHostOptions(options, webSocketPath),
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: false,
      },
    },
  };
}

function getPublicHostOptions(
  options: NormalizedAngularRspackPluginOptions,
  webSocketPath: string
): string {
  let publicHost = options.devServer.publicHost;

  if (publicHost) {
    const hostWithProtocol = !/^\w+:\/\//.test(publicHost)
      ? `https://${publicHost}`
      : publicHost;
    publicHost = new URL(hostWithProtocol).host;
  }

  return `auto://${publicHost || '0.0.0.0:0'}${webSocketPath}`;
}

function getJsonErrorLineColumn(offset: number, content: string) {
  if (offset === 0) {
    return { line: 1, column: 1 };
  }

  let line = 0;
  let position = 0;
  while (true) {
    ++line;

    const nextNewline = content.indexOf('\n', position);
    if (nextNewline === -1 || nextNewline > offset) {
      break;
    }

    position = nextNewline + 1;
  }

  return { line, column: offset - position + 1 };
}

function normalizeProxyConfiguration(
  proxy: Record<string, object> | object[]
): DevServer['proxy'] {
  return Array.isArray(proxy)
    ? proxy
    : Object.entries(proxy).map(([context, value]) => ({
        context: [context],
        ...value,
      }));
}

function assertIsError(
  value: unknown
): asserts value is Error & { code?: string } {
  const isError =
    value instanceof Error ||
    // The following is needing to identify errors coming from RxJs.
    (typeof value === 'object' &&
      value &&
      'name' in value &&
      'message' in value);
  assert(isError, 'catch clause variable is not an Error instance');
}
