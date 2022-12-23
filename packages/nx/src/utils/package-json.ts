import { existsSync } from 'fs';
import { dirname, join } from 'path';
import {
  InputDefinition,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import { readJsonFile } from './fileutils';
import { workspaceRoot } from './workspace-root';

export type PackageJsonTargetConfiguration = Omit<
  TargetConfiguration,
  'executor'
>;

export interface NxProjectPackageJsonConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
  namedInputs?: { [inputName: string]: (string | InputDefinition)[] };
  targets?: Record<string, PackageJsonTargetConfiguration>;
  includedScripts?: string[];
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
  license?: string;
  scripts?: Record<string, string>;
  type?: 'module' | 'commonjs';
  main?: string;
  types?: string;
  module?: string;
  exports?:
    | string
    | Record<
        string,
        string | { types?: string; require?: string; import?: string }
      >;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
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
): TargetConfiguration {
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

/**
 * Uses `require.resolve` to read the package.json for a module.
 *
 * This will fail if the module doesn't export package.json
 *
 * @returns package json contents and path
 */
export function readModulePackageJsonWithoutFallbacks(
  moduleSpecifier: string,
  requirePaths = [workspaceRoot]
): {
  packageJson: PackageJson;
  path: string;
} {
  const packageJsonPath: string = require.resolve(
    `${moduleSpecifier}/package.json`,
    {
      paths: requirePaths,
    }
  );
  const packageJson: PackageJson = readJsonFile(packageJsonPath);

  return {
    path: packageJsonPath,
    packageJson,
  };
}

/**
 * Reads the package.json file for a specified module.
 *
 * Includes a fallback that accounts for modules that don't export package.json
 *
 * @param {string} moduleSpecifier The module to look up
 * @param {string[]} requirePaths List of paths look in. Pass `module.paths` to ensure non-hoisted dependencies are found.
 *
 * @example
 * // Use the caller's lookup paths for non-hoisted dependencies
 * readModulePackageJson('http-server', module.paths);
 *
 * @returns package json contents and path
 */
export function readModulePackageJson(
  moduleSpecifier: string,
  requirePaths = [workspaceRoot]
): {
  packageJson: PackageJson;
  path: string;
} {
  let packageJsonPath: string;
  let packageJson: PackageJson;

  try {
    ({ path: packageJsonPath, packageJson } =
      readModulePackageJsonWithoutFallbacks(moduleSpecifier, requirePaths));
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

    packageJson = readJsonFile(packageJsonPath);
    if (packageJson.name && packageJson.name !== moduleSpecifier) {
      throw new Error(
        `Found module ${packageJson.name} while trying to locate ${moduleSpecifier}/package.json`
      );
    }
  }

  return {
    packageJson,
    path: packageJsonPath,
  };
}
