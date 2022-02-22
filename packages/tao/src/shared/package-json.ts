import { TargetConfiguration } from './workspace';

export type PackageJsonTargetConfiguration = Omit<
  TargetConfiguration,
  'executor'
>;

export interface NxProjectPackageJsonConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
  targets?: Record<string, PackageJsonTargetConfiguration>;
}

export interface PackageJson {
  // Generic Package.Json Configuration
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // Nx Project Configuration
  nx?: NxProjectPackageJsonConfiguration;

  // Nx Plugin Configuration
  generators?: string;
  schematics?: string;
  builders?: string;
  executors?: string;
  'nx-migrations'?: string;
}

export function buildTargetFromScript(
  script: string,
  nx: NxProjectPackageJsonConfiguration
) {
  const nxTargetConfiguration = nx?.targets?.[script] || {};

  return {
    ...nxTargetConfiguration,
    executor: '@nrwl/workspace:run-script',
    options: {
      ...(nxTargetConfiguration.options || {}),
      script,
    },
  };
}
