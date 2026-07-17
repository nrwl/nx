import { existsSync } from 'node:fs';
import { join } from 'node:path/posix';
import type * as ts from 'typescript';
import {
  ensureCjsResolverPatched,
  ensureNodeNextEsmResolverRegistered,
  ensureResolveConditionsInjected,
  isNativeStripPreferred,
  registerTranspiler,
  registerTsConfigPaths,
} from '../../plugins/js/utils/register';
import {
  getRootTsConfigResolveExportsConditions,
  readTsConfigWithoutFiles,
} from '../../plugins/js/utils/typescript';
import { workspaceRoot } from '../../utils/workspace-root';

export let unregisterPluginTSTranspiler: (() => void) | null = null;

const NOOP = () => {};

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 *
 * When the runtime supports native TypeScript stripping and the user hasn't
 * opted out, this is a noop - Node loads plugin `.ts` files directly. The
 * lazy fallback in `handleImport` will call `forceRegisterPluginTSTranspiler`
 * if a plugin uses unsupported syntax (enum, runtime namespace, etc.).
 */
export function registerPluginTSTranspiler() {
  if (unregisterPluginTSTranspiler !== null) {
    return;
  }

  // Align Node's runtime resolution with the source-first plugin entry so the
  // plugin's transitive workspace imports don't fall through to unbuilt `dist`.
  // A no-op inside a plugin worker/daemon already spawned with `--conditions`.
  ensureResolveConditionsInjected(
    getRootTsConfigResolveExportsConditions(workspaceRoot)
  );

  if (isNativeStripPreferred()) {
    // Native strip handles `.ts` syntax but doesn't rewrite NodeNext-style
    // `.js` relative specifiers to their `.ts` sources. Patch the CJS resolver
    // so `require('./foo.js')` from a `.ts` plugin source falls back to
    // `./foo.ts`, and register an ESM resolution hook so the same rewrite
    // happens on the dynamic-import path (the CJS patch can't reach ESM
    // resolution). Both are idempotent and best-effort.
    ensureCjsResolverPatched();
    ensureNodeNextEsmResolverRegistered();
    // Sentinel so pluginTranspilerIsRegistered() reports true and callers
    // don't keep retrying. The actual transpiler stays unregistered until
    // a fallback forces it.
    unregisterPluginTSTranspiler = NOOP;
    return;
  }

  doRegisterPluginTSTranspiler();
}

/**
 * Always register swc-node or ts-node + tsconfig-paths, ignoring the native
 * strip preference. Called from the fallback path in `handleImport` when a
 * plugin `.ts` file throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under native
 * stripping.
 */
export function forceRegisterPluginTSTranspiler() {
  // If the previous registration was the native-strip sentinel, throw it
  // out so we actually wire up swc/ts-node.
  if (unregisterPluginTSTranspiler === NOOP) {
    unregisterPluginTSTranspiler = null;
  }
  if (unregisterPluginTSTranspiler !== null) {
    return;
  }
  doRegisterPluginTSTranspiler();
}

function doRegisterPluginTSTranspiler() {
  // Get the first tsconfig that matches the allowed set
  const tsConfigName = [
    join(workspaceRoot, 'tsconfig.base.json'),
    join(workspaceRoot, 'tsconfig.json'),
  ].find((x) => existsSync(x));

  if (!tsConfigName) {
    return;
  }

  const tsConfig: Partial<ts.ParsedCommandLine> = tsConfigName
    ? readTsConfigWithoutFiles(tsConfigName)
    : {};
  const cleanupFns = [
    registerTsConfigPaths(tsConfigName),
    registerTranspiler(
      {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        ...tsConfig.options,
      },
      tsConfig.raw
    ),
  ];
  // Fall back from NodeNext `.js` specifiers to their `.ts` sources when a
  // `.ts` plugin source require()s a sibling. Idempotent.
  ensureCjsResolverPatched();
  unregisterPluginTSTranspiler = () => {
    cleanupFns.forEach((fn) => fn?.());
  };
}

export function pluginTranspilerIsRegistered() {
  return unregisterPluginTSTranspiler !== null;
}

export function cleanupPluginTSTranspiler() {
  unregisterPluginTSTranspiler?.();
  unregisterPluginTSTranspiler = null;
}
