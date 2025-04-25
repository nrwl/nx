import type { DevServer } from '@rspack/core';
import assert from 'node:assert';
import { existsSync, promises as fsPromises } from 'node:fs';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEsmModule } from '../utils/misc-helpers';

export function getAllowedHostsConfig(
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

export async function getProxyConfig(
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
        if (e.code !== 'ERR_REQUIRE_ESM') {
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
