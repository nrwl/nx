import { extname, resolve } from 'path';

const STRIP_TYPES_DOCS_URL =
  'https://nx.dev/docs/reference/environment-variables#nx-prefer-node-strip-types';

/**
 * Dynamically imports a module using CJS require().
 * Provides a single point of change for future ESM migration.
 *
 * Falls back to real import() for ESM-only packages that
 * throw ERR_REQUIRE_ESM. When loading a workspace plugin's `.ts` entry
 * under native TypeScript stripping, also falls back to swc/ts-node if
 * the file uses constructs Node can't strip (enum, runtime namespace,
 * legacy decorators, etc.).
 *
 * @param modulePath - The module specifier (relative, absolute, or package name)
 * @param relativeTo - The directory to resolve relative paths against.
 *   Pass `__dirname` from the call site when using relative paths like './foo.js'.
 */
export async function handleImport<T = any>(
  modulePath: string,
  relativeTo?: string
): Promise<T> {
  let resolvedPath = modulePath;
  if (
    relativeTo &&
    (modulePath.startsWith('./') || modulePath.startsWith('../'))
  ) {
    resolvedPath = resolve(relativeTo, modulePath);
  }
  const normalizedPath =
    extname(resolvedPath) === '.js' ? resolvedPath.slice(0, -3) : resolvedPath;
  try {
    return require(normalizedPath) as T;
  } catch (e: any) {
    // ERR_REQUIRE_ESM (legacy) and ERR_REQUIRE_ASYNC_MODULE (Node 22.12+,
    // ESM with top-level await) both indicate the module must be loaded via
    // dynamic import(). Native strip handles `.ts` extension resolution on
    // the import() path, so this recovers TLA plugin entry points without
    // requiring swc-node or ts-node to be installed.
    if (e.code === 'ERR_REQUIRE_ESM' || e.code === 'ERR_REQUIRE_ASYNC_MODULE') {
      return import(resolvedPath) as Promise<T>;
    }
    // Mirror `loadTsFile`'s fallback set (register.ts). Plugin loads hit a
    // wider failure surface than .ts config loads because plugin sources are
    // often ESM and import type-only symbols from `@nx/devkit` as runtime
    // named exports. Lazy-require the matchers to keep register/transpiler
    // (and their daemon/logger deps) out of module-eval-time graphs.
    const matchers =
      require('../plugins/js/utils/register') as typeof import('../plugins/js/utils/register');
    if (
      e?.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' ||
      e?.code === 'MODULE_NOT_FOUND' ||
      e?.code === 'ERR_MODULE_NOT_FOUND' ||
      matchers.isTsEsmSyntaxError(e, resolvedPath) ||
      matchers.isTsEsmNamedExportLinkageError(e, resolvedPath) ||
      matchers.isCjsSyntaxError(e, resolvedPath) ||
      matchers.isRequireInEsmScopeError(e, resolvedPath)
    ) {
      // Lazy-require to avoid pulling register/transpiler (and their
      // daemon/logger transitive deps) into module-eval-time graphs.
      const { forceRegisterPluginTSTranspiler } =
        require('../project-graph/plugins/transpiler') as typeof import('../project-graph/plugins/transpiler');
      forceRegisterPluginTSTranspiler();
      try {
        delete require.cache[require.resolve(normalizedPath)];
      } catch {
        // require.resolve may throw if the failed load never reached cache
      }
      try {
        return require(normalizedPath) as T;
      } catch (retryErr: any) {
        // Mirror the initial-catch behavior: if the compiled output surfaces
        // TLA or ESM-only-as-CJS, dispatch to dynamic import() instead of
        // re-throwing. Without this, a plugin whose source needed the
        // transpiler fallback AND emits top-level await fails here instead of
        // loading.
        if (
          retryErr?.code === 'ERR_REQUIRE_ESM' ||
          retryErr?.code === 'ERR_REQUIRE_ASYNC_MODULE'
        ) {
          return import(resolvedPath) as Promise<T>;
        }
        if (retryErr instanceof Error) {
          // Lazy-require NX_PREFIX so we don't pull logger -> daemon into
          // module-eval-time graphs.
          const { NX_PREFIX } =
            require('./logger') as typeof import('./logger');
          retryErr.message = `${retryErr.message}\n\n${NX_PREFIX} Failed to load ${normalizedPath} under Node's native TypeScript stripping. Set NX_PREFER_NODE_STRIP_TYPES=false to opt out and use swc/ts-node instead. See ${STRIP_TYPES_DOCS_URL}`;
        }
        throw retryErr;
      }
    }
    throw e;
  }
}
