import type { moduleFederationPlugin } from '@module-federation/sdk';
import type { NormalModuleReplacementPlugin } from '@rspack/core';

export type ModuleFederationLibrary = { type: string; name: string };

export type WorkspaceLibrary = {
  name: string;
  root: string;
  importKey: string | undefined;
};

export type SharedWorkspaceLibraryConfig = {
  getAliases: () => Record<string, string>;
  getLibraries: (
    projectRoot: string,
    eager?: boolean
  ) => Record<string, SharedLibraryConfig>;
  getReplacementPlugin: () => NormalModuleReplacementPlugin;
};

export type Remotes = Array<string | [remoteName: string, remoteUrl: string]>;

export interface SharedLibraryConfig {
  singleton?: boolean;
  strictVersion?: boolean;
  requiredVersion?: false | string;
  eager?: boolean;
}

export type SharedFunction = (
  libraryName: string,
  sharedConfig: SharedLibraryConfig
) => undefined | false | SharedLibraryConfig;

export type AdditionalSharedConfig = Array<
  | string
  | [libraryName: string, sharedConfig: SharedLibraryConfig]
  | { libraryName: string; sharedConfig: SharedLibraryConfig }
>;

export interface ModuleFederationConfig {
  name: string;
  remotes?: Remotes;
  library?: ModuleFederationLibrary;
  exposes?: Record<string, string>;
  shared?: SharedFunction;
  additionalShared?: AdditionalSharedConfig;
  /**
   * `nxRuntimeLibraryControlPlugin` is a runtime module federation plugin to ensure
   * that shared libraries are resolved from a remote with live reload capabilities.
   * If you run into any issues with loading shared libraries, try disabling this option.
   */
  disableNxRuntimeLibraryControlPlugin?: boolean;
}

export type NxModuleFederationConfigOverride = Omit<
  moduleFederationPlugin.ModuleFederationPluginOptions,
  | 'exposes'
  | 'remotes'
  | 'name'
  | 'library'
  | 'shared'
  | 'filename'
  | 'remoteType'
>;

export type WorkspaceLibrarySecondaryEntryPoint = {
  name: string;
  path: string;
};
