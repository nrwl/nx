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

/**
 * Every file TypeScript reads to settle a tsconfig: the file itself and each one
 * its `extends` chain reaches, including configs extended from a package.
 *
 * Observed rather than walked, so it resolves `extends` exactly as TypeScript
 * does, since it is TypeScript doing it.
 */
export function readTsConfigInputs(tsConfigPath: string): string[] {
  if (!tsModule) {
    tsModule = require('typescript');
  }
  const read = new Set<string>();
  const sys: ts.System = {
    ...tsModule.sys,
    readFile: (path, encoding) => {
      const contents = tsModule.sys.readFile(path, encoding);
      if (contents !== undefined) {
        read.add(path);
      }
      return contents;
    },
  };
  readTsConfig(tsConfigPath, sys);
  return [...read];
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

export function getRootTsConfigFileName(
  root: string = workspaceRoot
): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = join(root, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigName;
    }
  }

  return null;
}

export function getRootTsConfigPath(
  root: string = workspaceRoot
): string | null {
  const tsConfigFileName = getRootTsConfigFileName(root);

  return tsConfigFileName ? join(root, tsConfigFileName) : null;
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

/**
 * Node `--conditions <name>` CLI args for spawning a plugin worker or the daemon
 * with the plugin-resolution conditions active at startup. Mirrors the set Nx
 * uses to resolve the plugin entry (`getRootTsConfigResolveExportsConditions`)
 * so the entry and the plugin's transitive workspace imports resolve the same
 * way; Node's own resolver otherwise ignores TypeScript `customConditions` and a
 * source-loaded plugin's imports land on their unbuilt `dist`.
 */
export function getPluginResolveConditionNodeArgs(
  root: string = workspaceRoot
): string[] {
  return getRootTsConfigResolveExportsConditions(root).flatMap((c) => [
    '--conditions',
    c,
  ]);
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
