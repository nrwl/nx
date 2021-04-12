import { dirname } from 'path';
import type * as ts from 'typescript';
import { appRootPath } from './app-root';

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
  const { options } = readTsConfig(tsConfigPath);
  const host = tsModule.createCompilerHost(options, true);
  const moduleResolutionCache = tsModule.createModuleResolutionCache(
    appRootPath,
    host.getCanonicalFileName
  );
  return { options, host, moduleResolutionCache };
}
