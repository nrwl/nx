import { TargetConfiguration } from '../config/workspace-json-project-json';

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
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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
