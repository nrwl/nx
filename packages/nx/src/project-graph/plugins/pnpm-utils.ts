import { existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { readJsonFile } from '../../utils/fileutils';
import { PackageJson } from '../../utils/package-json';

function isTypeScriptSource(entryPath: string, packageDir: string): boolean {
  const fullPath = join(packageDir, entryPath);

  if (entryPath.endsWith('.ts')) {
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

  return existsSync(basePath + '.ts') && !existsSync(basePath + '.js');
}

export function isWorkspaceSourcePackage(packageJsonPath: string): boolean {
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const packageJson = readJsonFile(packageJsonPath);
  const packageDir = dirname(packageJsonPath);

  if (packageJson.exports && packageJson.exports['.']) {
    const exportPath =
      typeof packageJson.exports['.'] === 'string'
        ? packageJson.exports['.']
        : packageJson.exports['.'].default || packageJson.exports['.'].main;
    if (exportPath) {
      return isTypeScriptSource(exportPath, packageDir);
    }
  }

  const entryPoint = packageJson.main || packageJson.module;
  if (entryPoint) {
    return isTypeScriptSource(entryPoint, packageDir);
  }

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
