import { workspaceRoot } from '../../../utils/workspace-root';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type * as ts from 'typescript';
import type { Node, SyntaxKind } from 'typescript';

const normalizedAppRoot = workspaceRoot.replace(/\\/g, '/');

let tsModule: typeof import('typescript');

export function readTsConfig(
  tsConfigPath: string,
  sys?: ts.System
): ts.ParsedCommandLine {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  sys ??= tsModule.sys;

  const readResult = tsModule.readConfigFile(tsConfigPath, sys.readFile);
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    sys,
    dirname(tsConfigPath)
  );
}

export function readTsConfigWithoutFiles(
  tsConfigPath: string
): ts.ParsedCommandLine {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  // We only care about options, so we don't need to scan source files, and thus
  // `readDirectory` is stubbed for performance.
  const sys = {
    ...tsModule.sys,
    readDirectory: () => [],
  };

  return readTsConfig(tsConfigPath, sys);
}

export function readTsConfigOptions(tsConfigPath: string): ts.CompilerOptions {
  const { options } = readTsConfigWithoutFiles(tsConfigPath);

  return options;
}

let compilerHost: {
  host: ts.CompilerHost;
  options: ts.CompilerOptions;
  moduleResolutionCache: ts.ModuleResolutionCache;
};

/**
 * Find a module based on its import
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

export function getRootTsConfigFileName(): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(workspaceRoot, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigName;
    }
  }

  return null;
}

export function getRootTsConfigPath(): string | null {
  const tsConfigFileName = getRootTsConfigFileName();

  return tsConfigFileName ? join(workspaceRoot, tsConfigFileName) : null;
}

const customConditionsCache = new Map<string, string[]>();
export function getRootTsConfigCustomConditions(
  root: string = workspaceRoot
): string[] {
  if (customConditionsCache.has(root)) {
    return customConditionsCache.get(root)!;
  }

  // Resolve via the TypeScript API rather than a raw JSON read so that
  // `customConditions` inherited through `extends` chains are honored —
  // matches what TypeScript itself sees when resolving package exports.
  let conditions: string[] = [];
  for (const name of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(root, name);
    if (!existsSync(tsConfigPath)) {
      continue;
    }
    try {
      const options = readTsConfigOptions(tsConfigPath);
      if (Array.isArray(options.customConditions)) {
        conditions = options.customConditions.filter(
          (c): c is string => typeof c === 'string'
        );
      }
    } catch {}
    break;
  }

  customConditionsCache.set(root, conditions);
  return conditions;
}

/**
 * Conditions list for `resolve.exports`: workspace `customConditions` plus
 * `development` as backward-compat for workspaces not yet migrated by
 * `migrate-development-custom-condition` (21.5).
 */
export function getRootTsConfigResolveExportsConditions(
  root: string = workspaceRoot
): string[] {
  const conditions = getRootTsConfigCustomConditions(root);
  return conditions.includes('development')
    ? conditions
    : [...conditions, 'development'];
}

export function findNodes(
  node: Node,
  kind: SyntaxKind | SyntaxKind[],
  max = Infinity
): Node[] {
  if (!node || max == 0) {
    return [];
  }

  const arr: Node[] = [];
  const hasMatch = Array.isArray(kind)
    ? kind.includes(node.kind)
    : node.kind === kind;
  if (hasMatch) {
    arr.push(node);
    max--;
  }
  if (max > 0) {
    for (const child of node.getChildren()) {
      findNodes(child, kind, max).forEach((node) => {
        if (max > 0) {
          arr.push(node);
        }
        max--;
      });

      if (max <= 0) {
        break;
      }
    }
  }

  return arr;
}
