import { ModuleFederationConfig, SharedLibraryConfig } from '../../utils';
import {
  createDefaultRemoteUrlResolver,
  FrameworkConfig,
  getModuleFederationConfigAsync,
  getModuleFederationConfigSync as getModuleFederationConfigSyncCore,
} from '../../utils/module-federation-config';

/**
 * Default npm packages to always share for Angular projects.
 */
export const DEFAULT_ANGULAR_PACKAGES_TO_SHARE = [
  '@angular/core',
  '@angular/animations',
  '@angular/common',
];

/**
 * npm packages to avoid sharing in Angular projects.
 */
export const DEFAULT_NPM_PACKAGES_TO_AVOID = [
  'zone.js',
  '@nx/angular/mf',
  '@nrwl/angular/mf',
  '@nx/angular-rspack',
];

/**
 * Applies eager loading to default Angular packages.
 * Exported for backward compatibility.
 */
export function applyDefaultEagerPackages(
  sharedConfig: Record<string, SharedLibraryConfig>,
  useRspack = false
) {
  const DEFAULT_PACKAGES_TO_LOAD_EAGERLY = [
    '@angular/localize',
    '@angular/localize/init',
    ...(useRspack
      ? [
          '@angular/core',
          '@angular/core/primitives/signals',
          '@angular/core/primitives/di',
          '@angular/core/event-dispatch',
          '@angular/core/rxjs-interop',
          '@angular/common',
          '@angular/common/http',
          '@angular/platform-browser',
        ]
      : []),
  ];
  for (const pkg of DEFAULT_PACKAGES_TO_LOAD_EAGERLY) {
    if (!sharedConfig[pkg]) {
      continue;
    }
    sharedConfig[pkg] = { ...sharedConfig[pkg], eager: true };
  }
}

/**
 * Creates the default remote URL resolver for Angular.
 * Kept for backward compatibility with existing configs.
 */
export function getFunctionDeterminateRemoteUrl(
  isServer: boolean = false,
  useRspack = false
) {
  return createDefaultRemoteUrlResolver(isServer, useRspack ? 'js' : 'mjs');
}

/**
 * Creates framework config for Angular projects.
 */
function getAngularFrameworkConfig(
  bundler: 'rspack' | 'webpack',
  useRspack: boolean
): FrameworkConfig {
  return {
    bundler,
    remoteEntryExt: useRspack ? 'js' : 'mjs',
    mapRemotesExpose: false,
    defaultPackagesToShare: DEFAULT_ANGULAR_PACKAGES_TO_SHARE,
    packagesToAvoid: DEFAULT_NPM_PACKAGES_TO_AVOID,
    applyEagerPackages: (sharedConfig: Record<string, SharedLibraryConfig>) => {
      applyDefaultEagerPackages(sharedConfig, useRspack);
    },
  };
}

export async function getModuleFederationConfig(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false },
  bundler: 'rspack' | 'webpack' = 'rspack'
) {
  // Angular async uses 'mjs' extension (webpack), not rspack
  return getModuleFederationConfigAsync(
    mfConfig,
    options,
    getAngularFrameworkConfig(bundler, false)
  );
}

export function getModuleFederationConfigSync(
  mfConfig: ModuleFederationConfig,
  options: {
    isServer: boolean;
    determineRemoteUrl?: (remote: string) => string;
  } = { isServer: false },
  useRspack = false
) {
  return getModuleFederationConfigSyncCore(
    mfConfig,
    options,
    getAngularFrameworkConfig('rspack', useRspack)
  );
}
