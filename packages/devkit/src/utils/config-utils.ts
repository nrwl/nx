import { existsSync, readdirSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { workspaceRoot } from 'nx/src/devkit-exports';
import {
  forceRegisterEsmLoader,
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

  // Both .ts and .mts go through loadTsFile first. Node 22.12+ supports
  // require() of synchronous ESM by default, and loadTsFile's lazy fallback
  // covers swc/ts-node + tsconfig-paths registration when needed (swc-node
  // hooks .cts/.mts/.ts via Module._extensions). Async-only ESM modules
  // (top-level await) throw ERR_REQUIRE_ASYNC_MODULE and fall through to
  // dynamic import(). ERR_REQUIRE_ESM is the legacy code for the same case
  // - kept for older Node lines.
  try {
    return loadTsFile(path, tsConfigPath);
  } catch (e: any) {
    if (
      e?.code !== 'ERR_REQUIRE_ESM' &&
      e?.code !== 'ERR_REQUIRE_ASYNC_MODULE'
    ) {
      throw e;
    }

    // The module must be loaded via dynamic import(). Register
    // tsconfig-paths first so workspace alias imports resolve, then try a
    // native dynamic import. Node 22.18+ LTS strips TS types on the ESM
    // path natively, so pure-ESM TLA configs load without any swc/ts-node
    // ESM loader. Only escalate to forceRegisterEsmLoader (which throws
    // when neither @swc-node/register nor ts-node is installed) if the
    // native attempt hits unsupported TS syntax.
    const cleanup = registerTsProject(tsConfigPath);
    try {
      return await loadESM(path);
    } catch (esmErr: any) {
      if (
        esmErr?.code !== 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' ||
        typeof forceRegisterEsmLoader !== 'function'
      ) {
        throw esmErr;
      }
      // Module.register is global and one-shot per process. After this
      // runs, every subsequent ESM import in the process is routed
      // through the registered loader, forfeiting Node's native TS
      // stripping for the dynamic-import path. If neither swc-node nor
      // ts-node is installed, forceRegisterEsmLoader throws - surface the
      // original ESM error in that case so the user sees the real
      // problem, not a misleading "loader missing" message.
      try {
        forceRegisterEsmLoader();
      } catch {
        throw esmErr;
      }
      return await loadESM(path);
    } finally {
      cleanup();
    }
  }
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
    if (['ERR_REQUIRE_ESM', 'ERR_REQUIRE_ASYNC_MODULE'].includes(e.code)) {
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

async function loadESM(path: string): Promise<any> {
  const pathAsFileUrl = pathToFileURL(path).pathname;
  return await dynamicImport(`${pathAsFileUrl}?t=${Date.now()}`);
}
