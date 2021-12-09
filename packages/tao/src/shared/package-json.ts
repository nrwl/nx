import { TargetConfiguration } from './workspace';

export type PackageJsonTargetConfiguration = Omit<
  TargetConfiguration,
  'executor'
>;

export interface NxProjectPackageJsonConfiguration {
  targets?: Record<string, PackageJsonTargetConfiguration>;
}

export interface PackageJson {
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  nx?: NxProjectPackageJsonConfiguration;
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
