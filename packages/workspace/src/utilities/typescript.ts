import { ensurePackage, Tree, workspaceRoot } from '@nx/devkit';
import { dirname } from 'path';
import type * as ts from 'typescript';
import { typescriptVersion } from '../utils/versions';
export { compileTypeScript } from './typescript/compilation';
export type { TypeScriptCompilationOptions } from './typescript/compilation';
export { getSourceNodes } from './typescript/get-source-nodes';

const normalizedAppRoot = workspaceRoot.replace(/\\/g, '/');

let tsModule: typeof import('typescript');

function readTsConfigOptions(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );

  // we don't need to scan the files, we only care about options
  const host: Partial<ts.ParseConfigHost> = {
    readDirectory: () => [],
    readFile: () => '',
    fileExists: tsModule.sys.fileExists,
  };

  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    host as ts.ParseConfigHost,
    dirname(tsConfigPath)
  ).options;
}

let compilerHost: {
  host: ts.CompilerHost;
  options: ts.CompilerOptions;
  moduleResolutionCache: ts.ModuleResolutionCache;
};

/**
 * Find a module based on it's import
 *
 * @param importExpr Import used to resolve to a module
 * @param filePath
 * @param tsConfigPath
 */
export function resolveModuleByImport(
  importExpr: string,
  filePath: string,
  tsConfigPath: string
) {
  compilerHost = compilerHost || getCompilerHost(tsConfigPath);
  const { options, host, moduleResolutionCache } = compilerHost;

  const { resolvedModule } = tsModule.resolveModuleName(
    importExpr,
    filePath,
    options,
    host,
    moduleResolutionCache
  );

  if (!resolvedModule) {
    return;
  } else {
    return resolvedModule.resolvedFileName.replace(`${normalizedAppRoot}/`, '');
  }
}

function getCompilerHost(tsConfigPath: string) {
  const options = readTsConfigOptions(tsConfigPath);
  const host = tsModule.createCompilerHost(options, true);
  const moduleResolutionCache = tsModule.createModuleResolutionCache(
    workspaceRoot,
    host.getCanonicalFileName
  );
  return { options, host, moduleResolutionCache };
}

export function ensureTypescript() {
  return ensurePackage<typeof import('typescript')>(
    'typescript',
    typescriptVersion
  );
}

import {
  getRelativePathToRootTsConfig as _getRelativePathToRootTsConfig,
  getRootTsConfigPathInTree as _getRootTsConfigPathInTree,
} from './ts-config';

/**
 * @deprecated Please import this from @nx/js instead. This function will be removed in v17
 */
export function getRelativePathToRootTsConfig(tree: Tree, targetPath: string) {
  return _getRelativePathToRootTsConfig(tree, targetPath);
}

/**
 * @deprecated Please import this from @nx/js instead. This function will be removed in v17
 */
export function getRootTsConfigPathInTree(tree: Tree) {
  return _getRootTsConfigPathInTree(tree);
}
