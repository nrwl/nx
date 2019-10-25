// Lifted in part from https://github.com/nrwl/angular-console
import { readdirSync } from 'fs';
import * as path from 'path';
import { readJsonFile } from './fileutils';

export interface Schematic {
  factory: string;
  schema: string;
  description: string;
  aliases: string;
  hidden: boolean;
}

export interface Builder {
  implementation: string;
  schema: string;
  description: string;
}

export interface PluginCapabilities {
  name: string;
  builders: { [name: string]: Builder };
  schematics: { [name: string]: Schematic };
}

export function getPluginVersion(workspaceRoot: string, name: string): string {
  try {
    const packageJson = readJsonFile(
      path.join(workspaceRoot, 'node_modules', name, 'package.json')
    );
    return packageJson.version;
  } catch {
    throw new Error(`Could not read package.json for module ${name}`);
  }
}

export function readCapabilitiesFromNodeModules(
  workspaceRoot: string
): Array<PluginCapabilities> {
  const packages = listOfUnnestedNpmPackages(workspaceRoot);
  return packages
    .map(name => getPluginCapabilities(workspaceRoot, name))
    .filter(x => x && !!(x.schematics || x.builders));
}

export function getPluginCapabilities(
  workspaceRoot: string,
  pluginName: string
): PluginCapabilities {
  try {
    const pluginPath = path.join(workspaceRoot, 'node_modules', pluginName);
    const packageJson = readJsonFile(path.join(pluginPath, 'package.json'));
    return {
      name: pluginName,
      schematics: tryGetCollection(
        pluginPath,
        packageJson.schematics,
        'schematics'
      ),
      builders: tryGetCollection(pluginPath, packageJson.builders, 'builders')
    };
  } catch {
    return null;
  }
}

function tryGetCollection<T>(
  pluginPath: string,
  jsonFile: string,
  propName: string
): T {
  if (!jsonFile) {
    return null;
  }

  try {
    return readJsonFile<T>(path.join(pluginPath, jsonFile))[propName];
  } catch {
    return null;
  }
}

let packageList: string[] = [];
export function listOfUnnestedNpmPackages(
  workspaceRoot: string,
  requery: boolean = false
): string[] {
  if (!requery && packageList.length > 0) {
    return packageList;
  }

  const nodeModulesDir = path.join(workspaceRoot, 'node_modules');
  readdirSync(nodeModulesDir).forEach(npmPackageOrScope => {
    if (npmPackageOrScope.startsWith('@')) {
      readdirSync(path.join(nodeModulesDir, npmPackageOrScope)).forEach(p => {
        packageList.push(`${npmPackageOrScope}/${p}`);
      });
    } else {
      packageList.push(npmPackageOrScope);
    }
  });

  return packageList;
}
