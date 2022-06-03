import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { TargetConfiguration } from '../config/workspace-json-project-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

export type PackageJsonTargetConfiguration = Omit<
  TargetConfiguration,
  'executor'
>;

export interface NxProjectPackageJsonConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
  targets?: Record<string, PackageJsonTargetConfiguration>;
}

export type PackageGroup =
  | (string | { package: string; version: string })[]
  | Record<string, string>;

export interface NxMigrationsConfiguration {
  migrations?: string;
  packageGroup?: PackageGroup;
}

export interface PackageJson {
  // Generic Package.Json Configuration
  name: string;
  version: string;
  scripts?: Record<string, string>;
  type?: 'module' | 'commonjs';
  main?: string;
  types?: string;
  module?: string;
  exports?: Record<
    string,
    { types?: string; require?: string; import?: string }
  >;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bin?: Record<string, string>;
  workspaces?:
    | string[]
    | {
        packages: string[];
      };

  // Nx Project Configuration
  nx?: NxProjectPackageJsonConfiguration;

  // Nx Plugin Configuration
  generators?: string;
  schematics?: string;
  builders?: string;
  executors?: string;
  'nx-migrations'?: string | NxMigrationsConfiguration;
  'ng-update'?: string | NxMigrationsConfiguration;
}

export function readNxMigrateConfig(
  json: Partial<PackageJson>
): NxMigrationsConfiguration {
  const parseNxMigrationsConfig = (
    fromJson?: string | NxMigrationsConfiguration
  ): NxMigrationsConfiguration => {
    if (!fromJson) {
      return {};
    }
    if (typeof fromJson === 'string') {
      return { migrations: fromJson, packageGroup: [] };
    }

    return {
      ...(fromJson.migrations ? { migrations: fromJson.migrations } : {}),
      ...(fromJson.packageGroup ? { packageGroup: fromJson.packageGroup } : {}),
    };
  };

  return {
    ...parseNxMigrationsConfig(json['ng-update']),
    ...parseNxMigrationsConfig(json['nx-migrations']),
    // In case there's a `migrations` field in `package.json`
    ...parseNxMigrationsConfig(json as any),
  };
}

export function buildTargetFromScript(
  script: string,
  nx: NxProjectPackageJsonConfiguration
) {
  const nxTargetConfiguration = nx?.targets?.[script] || {};

  return {
    ...nxTargetConfiguration,
    executor: 'nx:run-script',
    options: {
      ...(nxTargetConfiguration.options || {}),
      script,
    },
  };
}

export function readModulePackageJson(
  moduleSpecifier: string,
  requirePaths = [workspaceRoot]
): {
  packageJson: PackageJson;
  path: string;
} {
  let packageJsonPath: string;
  try {
    packageJsonPath = require.resolve(`${moduleSpecifier}/package.json`, {
      paths: requirePaths,
    });
  } catch {
    const entryPoint = require.resolve(moduleSpecifier, {
      paths: requirePaths,
    });
    let moduleRootPath = dirname(entryPoint);
    packageJsonPath = join(moduleRootPath, 'package.json');

    while (!existsSync(packageJsonPath)) {
      moduleRootPath = dirname(moduleRootPath);
      packageJsonPath = join(moduleRootPath, 'package.json');
    }
  }

  const packageJson = readJsonFile(packageJsonPath);

  if (packageJson.name !== moduleSpecifier) {
    throw new Error(
      `Found module ${packageJson.name} while trying to locate ${moduleSpecifier}/package.json`
    );
  }

  return {
    packageJson,
    path: packageJsonPath,
  };
}
