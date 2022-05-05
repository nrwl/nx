export type ModuleFederationLibrary = { type: string; name: string };

export type Remotes = string[] | [remoteName: string, remoteUrl: string][];

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
  remotes?: string[];
  library?: ModuleFederationLibrary;
  exposes?: Record<string, string>;
  shared?: SharedFunction;
  additionalShared?: AdditionalSharedConfig;
}
