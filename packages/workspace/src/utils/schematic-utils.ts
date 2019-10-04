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

export function readSchematicCollectionsFromNodeModules(
  workspaceRoot: string
): Array<{ name: string; collection: SchematicCollection }> {
  const nodeModulesDir = path.join(workspaceRoot, 'node_modules');
  const packages = listOfUnnestedNpmPackages(nodeModulesDir);
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

export function listOfUnnestedNpmPackages(nodeModulesDir: string): string[] {
  const res: string[] = [];
  readdirSync(nodeModulesDir).forEach(npmPackageOrScope => {
    if (npmPackageOrScope.startsWith('@')) {
      readdirSync(path.join(nodeModulesDir, npmPackageOrScope)).forEach(p => {
        res.push(`${npmPackageOrScope}/${p}`);
      });
    } else {
      res.push(npmPackageOrScope);
    }
  });
  return res;
}
