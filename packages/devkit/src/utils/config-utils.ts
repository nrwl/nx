import { dirname, extname, join, sep } from 'path';
import { existsSync, readdirSync } from 'fs';
import { pathToFileURL } from 'node:url';
import { workspaceRoot } from 'nx/src/devkit-exports';
import { registerTsProject } from 'nx/src/devkit-internals';

export let dynamicImport = new Function(
  'modulePath',
  'return import(modulePath);'
);

export async function loadConfigFile<T extends object = any>(
  configFilePath: string
): Promise<T> {
  {
    let module: any;

    if (extname(configFilePath) === '.ts') {
      const siblingFiles = readdirSync(dirname(configFilePath));
      const tsConfigPath = siblingFiles.includes('tsconfig.json')
        ? join(dirname(configFilePath), 'tsconfig.json')
        : getRootTsConfigPath();
      if (tsConfigPath) {
        const unregisterTsProject = registerTsProject(tsConfigPath);
        try {
          module = await load(configFilePath);
        } finally {
          unregisterTsProject();
        }
      } else {
        module = await load(configFilePath);
      }
    } else {
      module = await load(configFilePath);
    }
    return module.default ?? module;
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

/**
 * Load the module after ensuring that the require cache is cleared.
 */
async function load(path: string): Promise<any> {
  // Clear cache if the path is in the cache
  if (require.cache[path]) {
    clearRequireCache();
  }

  try {
    // Try using `require` first, which works for CJS modules.
    // Modules are CJS unless it is named `.mjs` or `package.json` sets type to "module".
    return require(path);
  } catch (e: any) {
    if (e.code === 'ERR_REQUIRE_ESM') {
      // If `require` fails to load ESM, try dynamic `import()`. ESM requires file url protocol for handling absolute paths.
      const pathAsFileUrl = pathToFileURL(path).pathname;
      return await dynamicImport(`${pathAsFileUrl}?t=${Date.now()}`);
    }

    // Re-throw all other errors
    throw e;
  }
}
