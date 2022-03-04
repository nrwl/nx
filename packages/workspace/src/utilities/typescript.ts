import { Tree } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type * as ts from 'typescript';
export { compileTypeScript } from './typescript/compilation';
export type { TypeScriptCompilationOptions } from './typescript/compilation';
export { findNodes } from './typescript/find-nodes';
export { getSourceNodes } from './typescript/get-source-nodes';

const normalizedAppRoot = appRootPath.replace(/\\/g, '/');

let tsModule: any;

export function readTsConfig(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    tsModule.sys,
    dirname(tsConfigPath)
  );
}

function readTsConfigOptions(tsConfigPath: string) {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const readResult = tsModule.readConfigFile(
    tsConfigPath,
    tsModule.sys.readFile
  );
  // we don't need to scan the files, we only care about options
  const host = {
    readDirectory: () => [],
    fileExists: tsModule.sys.fileExists,
  };
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    host,
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
    appRootPath,
    host.getCanonicalFileName
  );
  return { options, host, moduleResolutionCache };
}

export function getRootTsConfigPathInTree(
  tree: Tree,
  throwIfNotFound: boolean = true
): string {
  for (const path of ['tsconfig.base.json', 'tsconfig.json']) {
    if (tree.exists(path)) {
      return path;
    }
  }

  if (throwIfNotFound) {
    throw new Error(
      'Could not find root tsconfig file. Tried with "tsconfig.base.json" and "tsconfig.json".'
    );
  }
}

export function getRootTsConfigFileName(): string | undefined {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(appRootPath, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigName;
    }
  }

  return undefined;
}

export function getRootTsConfigPath(): string | undefined {
  const tsConfigFileName = getRootTsConfigFileName();

  return tsConfigFileName ? join(appRootPath, tsConfigFileName) : undefined;
}
