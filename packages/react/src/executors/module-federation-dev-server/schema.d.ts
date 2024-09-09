import { WebDevServerOptions } from '@nx/webpack';

export type ModuleFederationDevServerOptions = WebDevServerOptions & {
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
};
