import { existsSync, readdirSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { workspaceRoot } from 'nx/src/devkit-exports';
import { registerTsProject } from 'nx/src/devkit-internals';
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

  if (tsConfigPath) {
    const unregisterTsProject = registerTsProject(tsConfigPath);
    try {
      return await loadModuleByExtension(path, extension);
    } finally {
      unregisterTsProject();
    }
  }

  return await loadModuleByExtension(path, extension);
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

async function loadESM(path: string): Promise<any> {
  const pathAsFileUrl = pathToFileURL(path).pathname;
  return await dynamicImport(`${pathAsFileUrl}?t=${Date.now()}`);
}
