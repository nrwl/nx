import { existsSync } from 'node:fs';
import { join } from 'node:path/posix';
import type * as ts from 'typescript';
import {
  registerTranspiler,
  registerTsConfigPaths,
} from '../../plugins/js/utils/register';
import { readTsConfigWithoutFiles } from '../../plugins/js/utils/typescript';
import { workspaceRoot } from '../../utils/workspace-root';

export let unregisterPluginTSTranspiler: (() => void) | null = null;

/**
 * When Node.js natively supports TypeScript (process.features.typescript is
 * truthy, available in Node 22.6+), we can skip registering swc-node or
 * ts-node transpilers since Node.js will handle TypeScript natively.
 *
 * This prevents the problematic fallback path where a missing SWC causes
 * ts-node to be used, which then fails on ESM plugins with ERR_REQUIRE_ESM
 * on Node 24.
 */
export function nodeNativelySupportsTypeScript(): boolean {
  return !!(process as any).features?.typescript;
}

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 *
 * If Node.js natively supports TypeScript (Node 22.6+), the transpiler
 * registration is skipped and only tsconfig path mappings are registered.
 * This avoids issues with ts-node's CommonJS require hooks breaking ESM
 * plugin loading on modern Node versions.
 */
export function registerPluginTSTranspiler() {
  // Get the first tsconfig that matches the allowed set
  const tsConfigName = [
    join(workspaceRoot, 'tsconfig.base.json'),
    join(workspaceRoot, 'tsconfig.json'),
  ].find((x) => existsSync(x));

  if (!tsConfigName) {
    return;
  }

  // When Node.js natively supports TypeScript, skip transpiler registration
  // but still register tsconfig-paths for path mapping support. This prevents
  // the ts-node fallback that breaks ESM plugins with ERR_REQUIRE_ESM.
  if (nodeNativelySupportsTypeScript()) {
    const cleanupFn = registerTsConfigPaths(tsConfigName);
    unregisterPluginTSTranspiler = () => {
      cleanupFn?.();
    };
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
