import { fileExists } from '../../../utils/fileutils';
import { resolveFromWorkspace } from '../../../utils/installation-directory';
import { workspaceRoot } from '../../../utils/workspace-root';
import { existsSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import type * as ts from 'typescript';
import type { Node, SyntaxKind } from 'typescript';
import {
  getTypescriptBackend,
  unhandledTypescriptBackend,
  withHostedTypescriptApi,
  withTypescriptApi,
  type ApiCompilerOptions,
  type ApiTypescriptBackend,
  type TypescriptApi,
  type TypescriptApiFileSystem,
} from './typescript-backend';

const normalizedAppRoot = workspaceRoot.replace(/\\/g, '/');

/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type ApiParsedCommandLine = import('typescript/sync').ParsedCommandLine;
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type ApiDiagnostic = import('typescript/sync').Diagnostic;
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type ApiModuleResolver = import('typescript/sync').ModuleResolver;

/**
 * Where a tsconfig read finds files instead of the disk, such as a generator's
 * `Tree`. A member left out uses the disk. Paths reach the members absolute or
 * relative to `getCurrentDirectory()`.
 */
export interface TsConfigHost extends TypescriptApiFileSystem {
  /**
   * Resolves relative paths, `tsConfigPath` included, and the paths read from
   * a relative `tsConfigPath` stay relative to it. Defaults to `process.cwd()`.
   */
  getCurrentDirectory?(): string;
}

export function isTypeScriptResolvable(): boolean {
  try {
    resolveFromWorkspace('typescript');
    return true;
  } catch {
    return false;
  }
}

/**
 * @param extendedConfigCache Shared across reads so each extended tsconfig is
 * parsed once. TypeScript 7.1 doesn't use it.
 */
export function readTsConfig(
  tsConfigPath: string,
  host?: TsConfigHost,
  extendedConfigCache?: Map<string, ts.ExtendedConfigCacheEntry>
): ts.ParsedCommandLine {
  return parseTsConfig(tsConfigPath, host, true, extendedConfigCache);
}

/**
 * Reads a tsconfig without scanning for its source files, for callers that
 * only need its options. `fileNames` can come back empty.
 *
 * @param extendedConfigCache Shared across reads so each extended tsconfig is
 * parsed once. TypeScript 7.1 doesn't use it.
 */
export function readTsConfigWithoutFiles(
  tsConfigPath: string,
  host?: TsConfigHost,
  extendedConfigCache?: Map<string, ts.ExtendedConfigCacheEntry>
): ts.ParsedCommandLine {
  return parseTsConfig(tsConfigPath, host, false, extendedConfigCache);
}

function parseTsConfig(
  tsConfigPath: string,
  host: TsConfigHost | undefined,
  scanFiles: boolean,
  extendedConfigCache: Map<string, ts.ExtendedConfigCacheEntry> | undefined
): ts.ParsedCommandLine {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic': {
      const tsModule = backend.ts;
      const parseHost = toParseConfigHost(tsModule.sys, host, scanFiles);
      const readResult = tsModule.readConfigFile(
        tsConfigPath,
        parseHost.readFile
      );
      return tsModule.parseJsonConfigFileContent(
        readResult.config,
        parseHost,
        dirname(tsConfigPath),
        undefined,
        undefined,
        undefined,
        undefined,
        extendedConfigCache
      );
    }
    case 'api':
      return readTsConfigWithApi(backend, tsConfigPath, host, scanFiles);
    default:
      return unhandledTypescriptBackend(backend);
  }
}

function toParseConfigHost(
  sys: ts.System,
  host: TsConfigHost | undefined,
  scanFiles: boolean
): ts.ParseConfigHost & ts.System {
  if (!host) {
    return scanFiles ? sys : { ...sys, readDirectory: () => [] };
  }
  const cwd = host.getCurrentDirectory?.() ?? sys.getCurrentDirectory();
  return {
    ...sys,
    getCurrentDirectory: () => cwd,
    readFile: (path) =>
      host.readFile ? host.readFile(path) : sys.readFile(path),
    fileExists: (path) =>
      host.fileExists ? host.fileExists(path) : sys.fileExists(path),
    directoryExists: (path) =>
      host.directoryExists
        ? host.directoryExists(path)
        : sys.directoryExists(path),
    realpath: (path) => sys.realpath(resolve(cwd, path)),
    readDirectory: scanFiles ? sys.readDirectory : () => [],
  };
}

export function readTsConfigOptions(tsConfigPath: string): ts.CompilerOptions {
  const { options } = readTsConfigWithoutFiles(tsConfigPath);

  return options;
}

let moduleResolver: TsModuleResolver | undefined;

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
  moduleResolver ??= createTsModuleResolver(readTsConfigOptions(tsConfigPath));

  const resolvedFileName = moduleResolver(importExpr, filePath);
  if (!resolvedFileName) {
    return;
  } else {
    return resolvedFileName.replace(`${normalizedAppRoot}/`, '');
  }
}

type TsModuleResolver = (
  moduleName: string,
  containingFile: string
) => string | undefined;

/**
 * Creates a function that resolves module names the way TypeScript does with
 * `compilerOptions` and returns the resolved file name. TypeScript 7.1 removed
 * `baseUrl` and ignores it.
 */
export function createTsModuleResolver(
  compilerOptions: ts.CompilerOptions
): TsModuleResolver {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic': {
      const tsModule = backend.ts;
      const host = tsModule.createCompilerHost(compilerOptions, true);
      const moduleResolutionCache = tsModule.createModuleResolutionCache(
        workspaceRoot,
        host.getCanonicalFileName
      );
      return (moduleName, containingFile) =>
        tsModule.resolveModuleName(
          moduleName,
          containingFile,
          compilerOptions,
          host,
          moduleResolutionCache
        ).resolvedModule?.resolvedFileName;
    }
    case 'api': {
      // TypeScript 6 resolves a relative `pathsBasePath` against the working
      // directory, the 7.1 server against the workspace root.
      const { pathsBasePath } = compilerOptions;
      const options = {
        ...compilerOptions,
        pathsBasePath:
          typeof pathsBasePath === 'string'
            ? resolve(pathsBasePath)
            : pathsBasePath,
      } as unknown as ApiCompilerOptions;
      let api: TypescriptApi | undefined;
      let resolver: ApiModuleResolver | undefined;
      return (moduleName, containingFile) =>
        withTypescriptApi(backend, (current) => {
          // The resolver lives in the API's server process, so a replaced
          // instance needs a new one.
          if (current !== api) {
            api = current;
            resolver = current.createModuleResolver(options);
          }
          // The 7.1 resolver takes the containing directory, not a file.
          return resolver.resolveModuleName(moduleName, dirname(containingFile))
            .resolvedModule?.resolvedFileName;
        });
    }
    default:
      return unhandledTypescriptBackend(backend);
  }
}

/**
 * Parses tsconfig JSON as if read from a file in `configDirectory`, with its
 * `extends` chain applied. Enum-valued options come back as the workspace's
 * TypeScript numbers them.
 */
export function parseTsConfigContent(
  json: object,
  configDirectory: string,
  host?: TsConfigHost
): ts.ParsedCommandLine {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic': {
      const tsModule = backend.ts;
      return tsModule.parseJsonConfigFileContent(
        json,
        toParseConfigHost(tsModule.sys, host, true),
        configDirectory
      );
    }
    case 'api': {
      const cwd = host?.getCurrentDirectory?.() ?? process.cwd();
      const parse = (api: TypescriptApi) =>
        api.parseJsonConfigFileContent(json, {
          configDirectory: resolve(cwd, configDirectory),
        });
      const parsed = host
        ? withHostedTypescriptApi(backend, host, true, parse)
        : withTypescriptApi(backend, parse);
      return toClassicParsedCommandLine(
        parsed,
        cwd,
        isAbsolute(configDirectory)
      );
    }
    default:
      return unhandledTypescriptBackend(backend);
  }
}

/**
 * Transpiles one module to JavaScript without type checking, as `ts.transpile`
 * does.
 */
export function transpileTypescript(
  input: string,
  compilerOptions: ts.CompilerOptions
): string {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return backend.ts.transpile(input, compilerOptions);
    case 'api':
      return withTypescriptApi(
        backend,
        (api) =>
          api.transpileModule(input, {
            compilerOptions: compilerOptions as unknown as ApiCompilerOptions,
          }).outputText
      );
    default:
      return unhandledTypescriptBackend(backend);
  }
}

function readTsConfigWithApi(
  backend: ApiTypescriptBackend,
  tsConfigPath: string,
  host: TsConfigHost | undefined,
  scanFiles: boolean
): ts.ParsedCommandLine {
  const cwd = host?.getCurrentDirectory?.() ?? process.cwd();
  const absolutePath = resolve(cwd, tsConfigPath);
  const exists = host?.fileExists
    ? host.fileExists(absolutePath)
    : fileExists(absolutePath);
  // TypeScript 6 reads a missing tsconfig as an empty one; 7.1 throws.
  const parse = exists
    ? (api: TypescriptApi) => api.parseConfigFile(absolutePath)
    : (api: TypescriptApi) =>
        api.parseJsonConfigFileContent(
          {},
          { configDirectory: dirname(absolutePath) }
        );
  // Only the hosted instance can skip the source-file scan.
  const parsed =
    host || !scanFiles
      ? withHostedTypescriptApi(backend, host ?? {}, scanFiles, parse)
      : withTypescriptApi(backend, parse);
  return toClassicParsedCommandLine(parsed, cwd, isAbsolute(tsConfigPath));
}

function toClassicParsedCommandLine(
  parsed: ApiParsedCommandLine,
  cwd: string,
  keepAbsolutePaths: boolean
): ts.ParsedCommandLine {
  // TypeScript 6 keeps the paths read from a relative tsconfig path relative;
  // the 7.1 API makes them absolute.
  const toResultPath = keepAbsolutePaths
    ? (path: string) => path
    : (path: string) => relative(cwd, path).replace(/\\/g, '/') || '.';
  const options = { ...parsed.options } as unknown as ts.CompilerOptions;
  for (const key of PATH_OPTIONS) {
    if (typeof options[key] === 'string') {
      options[key] = toResultPath(options[key] as string);
    }
  }
  for (const key of PATH_LIST_OPTIONS) {
    options[key] = options[key]?.map(toResultPath);
  }

  // `module`, `moduleResolution`, `target` and `jsx` values match TypeScript
  // 6's where both have the member; `newLine` and `moduleDetection` differ.
  return {
    options,
    fileNames: parsed.fileNames.map(toResultPath),
    projectReferences: parsed.projectReferences?.map((reference) => ({
      ...reference,
      path: toResultPath(reference.path),
    })),
    typeAcquisition: parsed.typeAcquisition as ts.TypeAcquisition,
    compileOnSave: parsed.compileOnSave,
    raw: parsed.raw,
    errors: parsed.errors.map(toClassicDiagnostic),
  };
}

// The path-valued options the 7.1 API resolves to absolute paths.
const PATH_OPTIONS = [
  'baseUrl',
  'configFilePath',
  'declarationDir',
  'generateCpuProfile',
  'generateTrace',
  'outDir',
  'outFile',
  'pathsBasePath',
  'pprofDir',
  'project',
  'rootDir',
  'tsBuildInfoFile',
] as const;
const PATH_LIST_OPTIONS = ['rootDirs', 'typeRoots'] as const;

function toClassicDiagnostic(diagnostic: ApiDiagnostic): ts.Diagnostic {
  return {
    category: diagnostic.category as ts.DiagnosticCategory,
    code: diagnostic.code,
    file: undefined,
    start: diagnostic.pos,
    length: diagnostic.end - diagnostic.pos,
    messageText: diagnostic.messageChain?.length
      ? toClassicMessageChain(diagnostic)
      : diagnostic.text,
  };
}

function toClassicMessageChain(
  diagnostic: ApiDiagnostic
): ts.DiagnosticMessageChain {
  return {
    messageText: diagnostic.text,
    category: diagnostic.category as ts.DiagnosticCategory,
    code: diagnostic.code,
    next: diagnostic.messageChain?.map(toClassicMessageChain),
  };
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
