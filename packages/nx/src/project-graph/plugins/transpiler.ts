import { existsSync } from 'node:fs';
import { join } from 'node:path/posix';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  registerTranspiler,
  registerTsConfigPaths,
} from '../../plugins/js/utils/register';
import { readTsConfigOptions } from '../../plugins/js/utils/typescript';
import type * as ts from 'typescript';

export let unregisterPluginTSTranspiler: (() => void) | null = null;

/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
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

  const tsConfigOptions: Partial<ts.CompilerOptions> = tsConfigName
    ? readTsConfigOptions(tsConfigName)
    : {};
  const cleanupFns = [
    registerTsConfigPaths(tsConfigName),
    registerTranspiler({
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      ...tsConfigOptions,
    }),
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
