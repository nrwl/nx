import { DevServerExecutorSchema } from '../dev-server/schema';

export type ModuleFederationDevServerOptions = DevServerExecutorSchema & {
  // Module Federation Specific Options
  devRemotes?: (
    | string
    | {
        remoteName: string;
        configuration: string;
      }
  )[];
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
    devRemotes: DevServerExecutorSchema['devRemotes'];
    verbose: boolean;
  };
