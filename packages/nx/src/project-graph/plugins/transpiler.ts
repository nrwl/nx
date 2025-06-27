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
