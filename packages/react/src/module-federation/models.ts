export interface SharedLibraryConfig {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string;
  eager: boolean;
}

export type ModuleFederationLibrary = { type: string; name: string };

export type Remotes = string[] | [remoteName: string, remoteUrl: string][];

export interface ModuleFederationConfig {
  name: string;
  remotes?: string[];
  library?: ModuleFederationLibrary;
  exposes?: Record<string, string>;
  shared?: (
    libraryName: string,
    library: SharedLibraryConfig
  ) => undefined | false | SharedLibraryConfig;
}
