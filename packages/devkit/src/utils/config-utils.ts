import { existsSync, readdirSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { types } from 'node:util';
import { workspaceRoot } from 'nx/src/devkit-exports';
import {
  forceRegisterEsmLoader,
  isRequireInEsmScopeError,
  isTsEsmNamedExportLinkageError,
  loadTsFile,
  registerTsProject,
} from 'nx/src/devkit-internals';
import { dirname, extname, join, sep } from 'path';

export let dynamicImport = new Function(
  'modulePath',
  'return import(modulePath);'
);

export async function loadConfigFile<T extends object = any>(
  configFilePath: string,
  tsconfigFileNames?: string[]
): Promise<T> {
  const extension = extname(configFilePath);
  const module = await loadModule(configFilePath, extension, tsconfigFileNames);
  return module.default ?? module;
}

async function loadModule(
  path: string,
  extension: string,
  tsconfigFileNames?: string[]
): Promise<any> {
  if (isTypeScriptFile(extension)) {
    return await loadTypeScriptModule(path, extension, tsconfigFileNames);
  }
  return await loadJavaScriptModule(path, extension);
}

function isTypeScriptFile(extension: string): boolean {
  return extension.endsWith('ts');
}

async function loadTypeScriptModule(
  path: string,
  extension: string,
  tsconfigFileNames?: string[]
): Promise<any> {
  const tsConfigPath = getTypeScriptConfigPath(path, tsconfigFileNames);

  if (!tsConfigPath) {
    return await loadModuleByExtension(path, extension);
  }

  // loadTsFile was added in nx@23. @nx/devkit's peer range supports older
  // nx majors, so fall back to the legacy registerTsProject + require path
  // when loadTsFile isn't available on the host nx.
  if (typeof loadTsFile !== 'function') {
    const cleanup = registerTsProject(tsConfigPath);
    try {
      return await loadModuleByExtension(path, extension);
    } finally {
      cleanup();
    }
  }

  // require.cache busting cannot invalidate a module the ESM registry
  // holds; reloads of known-ESM paths need a cache-busted import().
  const modulePath = resolveModulePath(path);
  if (esmRegistryPaths.has(modulePath)) {
    return await loadTsFileViaImport(path, tsConfigPath);
  }

  // A CJS-shaped .ts stays in require.cache and may have changed on disk
  // since; clear it so the reload re-reads the file.
  clearConfigFromRequireCache(modulePath);

  // Both .ts and .mts go through loadTsFile first. Node 22.12+ supports
  // require() of synchronous ESM by default, and loadTsFile's lazy fallback
  // covers swc/ts-node + tsconfig-paths registration when needed (swc-node
  // hooks .cts/.mts/.ts via Module._extensions). Async-only ESM modules
  // (top-level await) throw ERR_REQUIRE_ASYNC_MODULE and fall through to
  // dynamic import(). ERR_REQUIRE_ESM is the legacy code for the same case,
  // kept for older Node lines.
  try {
    const result = loadTsFile(path, tsConfigPath);
    if (types.isModuleNamespaceObject(result)) {
      esmRegistryPaths.add(modulePath);
    }
    return result;
  } catch (e: any) {
    if (
      e?.code !== 'ERR_REQUIRE_ESM' &&
      e?.code !== 'ERR_REQUIRE_ASYNC_MODULE'
    ) {
      throw e;
    }
    return await loadTsFileViaImport(path, tsConfigPath);
  }
}

// Resolved paths of configs that require() loaded as synchronous ESM;
// reloads of these route through loadTsFileViaImport. On globalThis so the
// state survives clearRequireCache evicting this module itself (a
// workspace-linked devkit resolves outside node_modules).
const esmRegistryPaths: Set<string> = ((globalThis as any)[
  Symbol.for('@nx/devkit:esmRegistryPaths')
] ??= new Set());

// Error codes from the load machinery (resolution, type stripping) that
// warrant registering swc/ts-node + tsconfig-paths and importing again.
// Unlisted errors propagate unchanged so a failing config is not
// re-evaluated. A not-found error can also come from the config's own
// dynamic import()/require() of a missing module, in which case the retry
// re-runs its top-level side effects; accepted so that static alias and
// extensionless imports (which fail at link time, before any user code
// runs) stay recoverable.
const ESM_LOAD_FALLBACK_ERROR_CODES = new Set([
  'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX',
  'ERR_MODULE_NOT_FOUND',
  'MODULE_NOT_FOUND',
  'ERR_UNKNOWN_FILE_EXTENSION',
]);

// Code-less errors that loadTsFile recovers on first load via the swc/
// ts-node fallback: a CJS-only global (__dirname, __filename, require) or a
// type-only named import evaluated on the native ESM path. Reloads must
// recover them too or an edit that introduces one turns into a hard graph
// failure. Prefer the host nx's classifiers so the gate matches what its
// loadTsFile recovers; nx versions that support the error classes without
// re-exporting the classifiers fall back to local replicas of them.
export function isTranspilerRecoverableError(
  err: unknown,
  path: string
): boolean {
  return (
    (typeof isRequireInEsmScopeError === 'function'
      ? isRequireInEsmScopeError(err, path)
      : isRequireInEsmScopeErrorReplica(err, path)) ||
    (typeof isTsEsmNamedExportLinkageError === 'function'
      ? isTsEsmNamedExportLinkageError(err, path)
      : isTsEsmNamedExportLinkageErrorReplica(err, path))
  );
}

function isRequireInEsmScopeErrorReplica(
  err: unknown,
  filePath: string
): boolean {
  if (!(err instanceof ReferenceError)) {
    return false;
  }
  if (!(filePath.endsWith('.ts') || filePath.endsWith('.mts'))) {
    return false;
  }
  return /(require|__dirname|__filename) is not defined/.test(err.message);
}

function isTsEsmNamedExportLinkageErrorReplica(
  err: unknown,
  filePath: string
): boolean {
  if (!(err instanceof SyntaxError)) {
    return false;
  }
  return (
    (filePath.endsWith('.ts') || filePath.endsWith('.mts')) &&
    err.message.includes('does not provide an export named')
  );
}

// Invalidates a config module and its local CommonJS dependency subtree,
// leaving unrelated cached modules untouched (a broad clear re-evaluates
// them and breaks singleton identity). Walks each module's recorded
// children AND the cache-current instance for the same id, since another
// config may retain an older instance of a shared dependency. Detaches the
// root from its requiring parent so repeated reloads don't accumulate
// Module objects in the parent's children array.
export function clearConfigFromRequireCache(
  rootId: string,
  cache: NodeJS.Dict<NodeModule> = require.cache
): void {
  const root = cache[rootId];
  if (!root) {
    return;
  }

  const visited = new Set<NodeModule>();
  const idsToDelete = new Set<string>();
  const queue: NodeModule[] = [root];
  while (queue.length) {
    const mod = queue.pop();
    if (!mod || visited.has(mod)) {
      continue;
    }
    visited.add(mod);
    if (packageInstallationDirectories.some((dir) => mod.id.includes(dir))) {
      continue;
    }
    idsToDelete.add(mod.id);
    const current = cache[mod.id];
    if (current && current !== mod) {
      queue.push(current);
    }
    for (const child of mod.children) {
      queue.push(child);
    }
  }

  for (const id of idsToDelete) {
    delete cache[id];
  }

  if (root.parent) {
    root.parent.children = root.parent.children.filter(
      (child) => child.id !== rootId
    );
  }
}

// Canonical key for require.cache checks and esmRegistryPaths: a symlinked
// config's caller path differs from require's resolved filename.
function resolveModulePath(path: string): string {
  try {
    return require.resolve(path);
  } catch {
    return path;
  }
}

async function loadTsFileViaImport(
  path: string,
  tsConfigPath: string
): Promise<any> {
  // Clear any prior require.cache entry so an ESM-to-CJS rewrite (or a
  // loader-classified CJS load) re-evaluates instead of serving the cached
  // copy.
  clearConfigFromRequireCache(resolveModulePath(path));

  // Try a bare native import first: Node 22.18+ strips TS types on the ESM
  // path natively, and registerTsProject must NOT run up front. A
  // registered swc/ts-node ESM loader intercepts every subsequent import
  // in the process (it cannot be unregistered) and may classify a .ts
  // config as CommonJS, defeating loadESM's cache-busting query on
  // reloads. Register only when the native attempt fails.
  try {
    return unwrapCjsInterop(path, await loadESM(path));
  } catch (esmErr: any) {
    if (
      !ESM_LOAD_FALLBACK_ERROR_CODES.has(esmErr?.code) &&
      !isTranspilerRecoverableError(esmErr, path)
    ) {
      throw esmErr;
    }
    const cleanup = registerTsProject(tsConfigPath);
    try {
      return unwrapCjsInterop(path, await loadESM(path));
    } catch (retryErr: any) {
      if (isTranspilerRecoverableError(retryErr, path)) {
        // A registered swc ESM loader compiles the retry to CJS, but
        // ts-node/esm keeps the file ESM, so CJS globals stay undefined on
        // the import path. Route through the CJS transpiler hook
        // registerTsProject installed; it reads fresh from disk. A
        // namespace result means no hook intercepted and require() hit the
        // stale ESM registry, so surface the error instead.
        const required = require(path);
        if (!types.isModuleNamespaceObject(required)) {
          return required;
        }
        throw retryErr;
      }
      if (
        retryErr?.code !== 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' ||
        typeof forceRegisterEsmLoader !== 'function'
      ) {
        throw retryErr;
      }
      // Loader registration cannot be undone. Preserve the import error
      // if registration itself fails.
      try {
        forceRegisterEsmLoader();
      } catch {
        throw retryErr;
      }
      return unwrapCjsInterop(path, await loadESM(path));
    } finally {
      cleanup();
    }
  }
}

// Some loaders emit CJS for a dynamic import, wrapping module.exports in
// namespace.default (with or without an __esModule marker). Unwrap only when
// require.cache proves the load went through the CJS pipeline; genuine ESM
// never populates require.cache, so its exports are preserved. The entry
// existence check keeps a default-less ESM namespace from matching on
// undefined === undefined.
export function unwrapCjsInterop(
  path: string,
  module: unknown,
  cache: NodeJS.Dict<NodeModule> = require.cache
): unknown {
  const entry = cache[resolveModulePath(path)];
  const cjsExports = (module as { default?: unknown } | null | undefined)
    ?.default;
  return entry && entry.exports === cjsExports ? cjsExports : module;
}

function getTypeScriptConfigPath(
  path: string,
  tsconfigFileNames?: string[]
): string | null {
  const siblingFiles = readdirSync(dirname(path));
  const tsConfigFileName = (tsconfigFileNames ?? ['tsconfig.json']).find(
    (name) => siblingFiles.includes(name)
  );
  return tsConfigFileName
    ? join(dirname(path), tsConfigFileName)
    : getRootTsConfigPath();
}

async function loadJavaScriptModule(
  path: string,
  extension: string
): Promise<any> {
  return await loadModuleByExtension(path, extension);
}

async function loadModuleByExtension(
  path: string,
  extension: string
): Promise<any> {
  switch (extension) {
    case '.cts':
    case '.cjs':
      return await loadCommonJS(path);
    case '.mjs':
      return await loadESM(path);
    default:
      // For both .ts and .mts files, try to load them as CommonJS first, then try ESM.
      // It's possible that the file is written like ESM (e.g. using `import`) but uses CJS features like `__dirname` or `__filename`.
      return await load(path);
  }
}

export function getRootTsConfigPath(): string | null {
  const tsConfigFileName = getRootTsConfigFileName();
  return tsConfigFileName ? join(workspaceRoot, tsConfigFileName) : null;
}

export function getRootTsConfigFileName(): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const pathExists = existsSync(join(workspaceRoot, tsConfigName));
    if (pathExists) {
      return tsConfigName;
    }
  }

  return null;
}

const packageInstallationDirectories = [
  `${sep}node_modules${sep}`,
  `${sep}.yarn${sep}`,
];

export function clearRequireCache(): void {
  for (const k of Object.keys(require.cache)) {
    if (!packageInstallationDirectories.some((dir) => k.includes(dir))) {
      delete require.cache[k];
    }
  }
}

async function load(path: string): Promise<any> {
  try {
    // Try using `require` first, which works for CJS modules.
    // Modules are CJS unless it is named `.mjs` or `package.json` sets type to "module".
    return await loadCommonJS(path);
  } catch (e: any) {
    if (e.code === 'ERR_REQUIRE_ESM') {
      // If `require` fails to load ESM, try dynamic `import()`. ESM requires file url protocol for handling absolute paths.
      return loadESM(path);
    }

    // Re-throw all other errors
    throw e;
  }
}

/**
 * Load the module after ensuring that the require cache is cleared.
 */
async function loadCommonJS(path: string): Promise<any> {
  // Clear cache if the path is in the cache
  if (require.cache[path]) {
    clearRequireCache();
  }
  return require(path);
}

// Global monotonic counter (not Date.now()) so two reloads never share a
// cache-busting URL, across same-millisecond loads, module reloads, and
// devkit copies.
const esmLoadState: { count: number } = ((globalThis as any)[
  Symbol.for('@nx/devkit:esmLoadState')
] ??= { count: 0 });

async function loadESM(path: string): Promise<any> {
  // Keep the full file URL (.pathname would drop a UNC authority); the
  // unique query gives each reload a fresh ESM registry key.
  const fileUrl = pathToFileURL(path);
  fileUrl.searchParams.set('t', (esmLoadState.count++).toString());
  return await dynamicImport(fileUrl.href);
}
