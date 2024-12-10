import { WebDevServerOptions } from '@nx/webpack';
import { DevRemoteDefinition } from '@nx/module-federation/src/executors/utils';

export type ModuleFederationDevServerOptions = WebDevServerOptions & {
  devRemotes?: DevRemoteDefinition[];
  skipRemotes?: string[];
  static?: boolean;
  isInitialHost?: boolean;
  parallel?: number;
  staticRemotesPort?: number;
  pathToManifestFile?: string;
  verbose?: boolean;
};

export type NormalizedModuleFederationDevServerOptions =
  ModuleFederationDevServerOptions & {
    devRemotes: DevRemoteDefinition[];
    verbose: boolean;
  };
