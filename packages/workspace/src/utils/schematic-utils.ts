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

export interface SchematicCollection {
  name: string;
  schematics: { [name: string]: Schematic };
}

export function getSchematicCollectionVersion(
  workspaceRoot: string,
  name: string
): string {
  try {
    const packageJson = readJsonFile(
      path.join(workspaceRoot, 'node_modules', name, 'package.json')
    );
    return packageJson.version;
  } catch {
    throw new Error(`Could not read package.json for module ${name}`);
  }
}

export function readSchematicCollectionsFromNodeModules(
  workspaceRoot: string
): Array<{ name: string; collection: SchematicCollection }> {
  const packages = listOfUnnestedNpmPackages(workspaceRoot);
  return packages
    .map(name => ({
      name,
      collection: getSchematicCollection(workspaceRoot, name)
    }))
    .filter(x => !!x.collection);
}

export function getSchematicCollection(
  workspaceRoot: string,
  collectionName: string
): SchematicCollection {
  const nodeModulesDir = path.join(workspaceRoot, 'node_modules');
  const packageJson = path.join(nodeModulesDir, collectionName, 'package.json');
  try {
    const jsonFile = readJsonFile(packageJson).schematics;
    return readJsonFile(path.join(nodeModulesDir, collectionName, jsonFile));
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
