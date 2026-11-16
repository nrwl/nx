import { dirname } from 'path';
import type * as ts from 'typescript';
import {
  getNxRequirePaths,
  resolveInstalledPackage,
} from '../../../utils/installation-directory';
import { workspaceRoot } from '../../../utils/workspace-root';

/** @ts-ignore resolves only when `typescript` is >= 7.1 */
export type TypescriptApiModule = typeof import('typescript/sync');
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
export type TypescriptApi = import('typescript/sync').API;
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
export type ApiCompilerOptions = import('typescript/sync').CompilerOptions;
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
export type TypescriptAstModule = typeof import('typescript/ast');
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
export type TypescriptAstGuardsModule = typeof import('typescript/ast/is');

/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type TypescriptAstFactoryModule = typeof import('typescript/ast/factory');
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type TypescriptApiFsModule = typeof import('typescript/fs');
/** @ts-ignore resolves only when `typescript` is >= 7.1 */
type FileSystemCallbacks = import('typescript/fs').FileSystemCallbacks;

export type ClassicTypescriptBackend = {
  kind: 'classic';
  version: string;
  packageJsonPath: string;
  ts: typeof ts;
};

export type ApiTypescriptBackend = {
  kind: 'api';
  version: string;
  packageJsonPath: string;
  sync: TypescriptApiModule;
  fs: TypescriptApiFsModule;
  ast: TypescriptAstModule;
  astGuards: TypescriptAstGuardsModule;
  factory: TypescriptAstFactoryModule;
};

/**
 * File system operations a TypeScript 7.1 API call sends to the caller instead
 * of the disk. Paths are absolute. A member left out uses the disk.
 */
export interface TypescriptApiFileSystem {
  readFile?(path: string): string | undefined;
  fileExists?(path: string): boolean;
  directoryExists?(path: string): boolean;
  getAccessibleEntries?(path: string): {
    files: string[];
    directories: string[];
  };
}

export type TypescriptBackend = ClassicTypescriptBackend | ApiTypescriptBackend;

export type TypescriptSetupErrorReason =
  | 'api-unavailable'
  | 'classic-required'
  | 'unrecognized';

export class TypescriptSetupError extends Error {
  readonly reason: TypescriptSetupErrorReason;

  constructor(reason: TypescriptSetupErrorReason, message: string) {
    super(message);
    this.name = 'TypescriptSetupError';
    this.reason = reason;
  }
}

const packageJsonPathByLookup = new Map<string, string>();
const backendByPackageJsonPath = new Map<string, TypescriptBackend>();
const apiByPackageJsonPath = new Map<string, TypescriptApi>();
const hostedApiByPackageJsonPath = new Map<string, TypescriptApi>();

type ActiveFileSystem = {
  fileSystem: TypescriptApiFileSystem;
  error?: { value: unknown };
};
let activeFileSystem: ActiveFileSystem | undefined;

/**
 * Loads the workspace's `typescript`, searching the Nx installation, the
 * workspace root and this nx installation, in that order.
 * Only `node_modules` inside the workspace or an nx installation count.
 * TypeScript < 7 loads the classic API, >= 7.1 the `typescript/sync` API, and
 * 7.0, which ships no API, throws a {@link TypescriptSetupError}. A missing
 * install throws the module resolution error.
 */
export function getTypescriptBackend(): TypescriptBackend {
  const lookupPaths = [...getNxRequirePaths(), __dirname];
  const lookupKey = lookupPaths.join('\0');
  let packageJsonPath = packageJsonPathByLookup.get(lookupKey);
  if (!packageJsonPath) {
    packageJsonPath = resolveInstalledPackage(
      'typescript/package.json',
      lookupPaths
    );
    packageJsonPathByLookup.set(lookupKey, packageJsonPath);
  }

  let backend = backendByPackageJsonPath.get(packageJsonPath);
  if (!backend) {
    backend = loadBackend(packageJsonPath, lookupPaths);
    backendByPackageJsonPath.set(packageJsonPath, backend);
  }
  return backend;
}

/**
 * Returns the classic TypeScript module, or throws a
 * {@link TypescriptSetupError} naming `feature` when the workspace's
 * `typescript` only provides the 7.1 API.
 */
export function requireClassicTypescript(feature: string): typeof ts {
  const backend = getTypescriptBackend();
  switch (backend.kind) {
    case 'classic':
      return backend.ts;
    case 'api':
      throw new TypescriptSetupError(
        'classic-required',
        `${feature} needs the TypeScript 6 API, but the workspace's "typescript" is ${backend.version}. Install TypeScript 6 as "typescript" and TypeScript ${backend.version} under an alias, e.g. "@typescript/native": "npm:typescript@${backend.version}".`
      );
    default: {
      const unhandled: never = backend;
      throw new Error(`Unhandled TypeScript backend: ${unhandled}`);
    }
  }
}

/**
 * Runs `fn` with this process's API instance for the backend's install,
 * creating it on first use. A dead server process drops the instance, so the
 * next call starts a new one; request errors keep it.
 */
export function withTypescriptApi<T>(
  backend: ApiTypescriptBackend,
  fn: (api: TypescriptApi) => T
): T {
  return runOnApi(
    apiByPackageJsonPath,
    backend,
    () => new backend.sync.API({ cwd: workspaceRoot }),
    fn
  );
}

/**
 * Like {@link withTypescriptApi}, but the file system operations `fn`'s
 * requests make go to `fileSystem`. An error `fileSystem` throws fails the
 * request and is rethrown as is.
 */
export function withHostedTypescriptApi<T>(
  backend: ApiTypescriptBackend,
  fileSystem: TypescriptApiFileSystem,
  fn: (api: TypescriptApi) => T
): T {
  const previous = activeFileSystem;
  const active: ActiveFileSystem = { fileSystem };
  activeFileSystem = active;
  try {
    return runOnApi(
      hostedApiByPackageJsonPath,
      backend,
      () =>
        new backend.sync.API({
          cwd: workspaceRoot,
          fs: createFileSystemCallbacks(backend.fs.serverFS),
        }),
      fn
    );
  } catch (e) {
    throw active.error ? active.error.value : e;
  } finally {
    activeFileSystem = previous;
  }
}

function runOnApi<T>(
  apiByInstall: Map<string, TypescriptApi>,
  backend: ApiTypescriptBackend,
  createApi: () => TypescriptApi,
  fn: (api: TypescriptApi) => T
): T {
  let api = apiByInstall.get(backend.packageJsonPath);
  if (!api) {
    api = createApi();
    apiByInstall.set(backend.packageJsonPath, api);
  }

  try {
    return fn(api);
  } catch (e) {
    if (isServerGoneError(e)) {
      apiByInstall.delete(backend.packageJsonPath);
      try {
        api.close();
      } catch {}
    }
    throw e;
  }
}

// The API reads its callbacks once, at construction, so they route each
// operation to the file system of the call in progress.
function createFileSystemCallbacks(
  serverFS: TypescriptApiFsModule['serverFS']
): FileSystemCallbacks {
  const call = <R>(run: (fileSystem: TypescriptApiFileSystem) => R) => {
    const active = activeFileSystem;
    if (!active) {
      return serverFS.useOS;
    }
    try {
      return run(active.fileSystem);
    } catch (e) {
      // A callback that throws breaks the API instance for every later
      // request; `serverFS.error` fails only this one.
      active.error ??= { value: e };
      return serverFS.error;
    }
  };

  return {
    readFile: (path) =>
      call((fileSystem) =>
        fileSystem.readFile ? fileSystem.readFile(path) : serverFS.useOS
      ),
    fileExists: (path) =>
      call((fileSystem) =>
        fileSystem.fileExists ? fileSystem.fileExists(path) : serverFS.useOS
      ),
    directoryExists: (path) =>
      call((fileSystem) =>
        fileSystem.directoryExists
          ? fileSystem.directoryExists(path)
          : serverFS.useOS
      ),
    getAccessibleEntries: (path) =>
      call((fileSystem) =>
        fileSystem.getAccessibleEntries
          ? { ...fileSystem.getAccessibleEntries(path), symlinks: undefined }
          : serverFS.useOS
      ),
    realpath: serverFS.useOS,
    stat: serverFS.useOS,
    writeFile: serverFS.useOS,
    removeFile: serverFS.useOS,
  };
}

function loadBackend(
  packageJsonPath: string,
  lookupPaths: string[]
): TypescriptBackend {
  const packageRoot = dirname(packageJsonPath);
  const version = require(packageJsonPath).version;
  const match = typeof version === 'string' && /^(\d+)\.(\d+)\./.exec(version);
  if (!match) {
    throw new TypescriptSetupError(
      'unrecognized',
      `Could not read the version of the TypeScript package at ${packageRoot}.`
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (major < 7) {
    // A directory require loads the package's `main`, so the classic module
    // comes from the same install that was classified.
    const tsModule: typeof ts = require(packageRoot);
    if (typeof tsModule?.createSourceFile !== 'function') {
      throw unrecognizedShape(version, packageRoot);
    }
    return { kind: 'classic', version, packageJsonPath, ts: tsModule };
  }

  if (major === 7 && minor === 0) {
    throw new TypescriptSetupError(
      'api-unavailable',
      `TypeScript ${version} has no programmatic API, which Nx needs. Install typescript@>=7.1, or install TypeScript 6 as "typescript" and TypeScript 7.0 under an alias, e.g. "@typescript/native": "npm:typescript@${version}".`
    );
  }

  const sync: TypescriptApiModule = require(
    resolveInstalledPackage('typescript/sync', lookupPaths)
  );
  const fs: TypescriptApiFsModule = require(
    resolveInstalledPackage('typescript/fs', lookupPaths)
  );
  const ast: TypescriptAstModule = require(
    resolveInstalledPackage('typescript/ast', lookupPaths)
  );
  const astGuards: TypescriptAstGuardsModule = require(
    resolveInstalledPackage('typescript/ast/is', lookupPaths)
  );
  const factory: TypescriptAstFactoryModule = require(
    resolveInstalledPackage('typescript/ast/factory', lookupPaths)
  );
  if (
    typeof sync?.API !== 'function' ||
    !fs?.serverFS ||
    !ast?.SyntaxKind ||
    typeof astGuards?.isIdentifier !== 'function' ||
    typeof factory?.createIdentifier !== 'function'
  ) {
    throw unrecognizedShape(version, packageRoot);
  }
  return {
    kind: 'api',
    version,
    packageJsonPath,
    sync,
    fs,
    ast,
    astGuards,
    factory,
  };
}

function unrecognizedShape(version: string, packageRoot: string) {
  return new TypescriptSetupError(
    'unrecognized',
    `The TypeScript ${version} package at ${packageRoot} does not expose the API its version implies.`
  );
}

// The sync client reports a dead server only through these messages.
function isServerGoneError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return (
    message.includes('EPIPE') ||
    message.includes('Unexpected EOF') ||
    message.includes('SyncRpcChannel is closed')
  );
}
