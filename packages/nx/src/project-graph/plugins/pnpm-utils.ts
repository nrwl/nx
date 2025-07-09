import { existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { readJsonFile } from '../../utils/fileutils';
import { PackageJson } from '../../utils/package-json';

function isTypeScriptSource(entryPath: string, packageDir: string): boolean {
  const fullPath = join(packageDir, entryPath);
  console.log(`[DEBUG] isTypeScriptSource - entryPath: ${entryPath}, packageDir: ${packageDir}, fullPath: ${fullPath}`);

  if (entryPath.endsWith('.ts')) {
    console.log(`[DEBUG] Entry path ends with .ts, returning true`);
    return true;
  }

  const ext = extname(entryPath);
  let basePath = fullPath;

  if (ext === '.js') {
    basePath = fullPath.slice(0, -ext.length);
  } else if (ext === '') {
    basePath = fullPath;
  } else {
    basePath = fullPath.slice(0, -ext.length);
  }

  const tsExists = existsSync(basePath + '.ts');
  const jsExists = existsSync(basePath + '.js');
  console.log(`[DEBUG] basePath: ${basePath}, .ts exists: ${tsExists}, .js exists: ${jsExists}`);
  
  return tsExists && !jsExists;
}

export function isWorkspaceSourcePackage(packageJsonPath: string): boolean {
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  console.log(`[DEBUG] Checking workspace source for: ${packageJsonPath}`);
  const packageJson = readJsonFile(packageJsonPath);
  const packageDir = dirname(packageJsonPath);
  
  console.log(`[DEBUG] Package.json main: ${packageJson.main}, module: ${packageJson.module}`);
  console.log(`[DEBUG] Package.json exports:`, packageJson.exports);

  if (packageJson.exports && packageJson.exports['.']) {
    const exportPath =
      typeof packageJson.exports['.'] === 'string'
        ? packageJson.exports['.']
        : packageJson.exports['.'].default || packageJson.exports['.'].main;
    if (exportPath) {
      console.log(`[DEBUG] Checking exports path: ${exportPath}`);
      const result = isTypeScriptSource(exportPath, packageDir);
      console.log(`[DEBUG] isTypeScriptSource for exports: ${result}`);
      return result;
    }
  }

  const entryPoint = packageJson.main || packageJson.module;
  if (entryPoint) {
    console.log(`[DEBUG] Checking entry point: ${entryPoint}`);
    const result = isTypeScriptSource(entryPoint, packageDir);
    console.log(`[DEBUG] isTypeScriptSource for entry point: ${result}`);
    return result;
  }

  console.log(`[DEBUG] No entry points found, returning false`);
  return false;
}

/**
 * Scans pnpm .pnpm directory for a specific plugin package.
 * Returns the first valid installed package (not workspace source) found.
 */
export function scanPnpmForPlugin(
  pluginName: string,
  pnpmDir: string
): { path: string; json: PackageJson } | null {
  if (!existsSync(pnpmDir)) {
    return null;
  }

  try {
    const pnpmEntries = require('fs').readdirSync(pnpmDir);

    for (const entry of pnpmEntries) {
      // Convert @nx/workspace to @nx+workspace pattern
      const expectedPattern = pluginName.replace('/', '+').replace('@', '');

      if (entry.includes(expectedPattern)) {
        const possiblePath = join(
          pnpmDir,
          entry,
          'node_modules',
          pluginName,
          'package.json'
        );

        if (
          existsSync(possiblePath) &&
          !isWorkspaceSourcePackage(possiblePath)
        ) {
          return {
            json: readJsonFile(possiblePath),
            path: possiblePath,
          };
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning pnpm directory: ${error.message}`);
  }

  return null;
}
