import { WebSsrDevServerOptions } from '@nx/webpack/src/executors/ssr-dev-server/schema';
import { DevRemoteDefinition } from '@nx/module-federation/src/executors/utils';

export type ModuleFederationSsrDevServerOptions = WebSsrDevServerOptions & {
  devRemotes?: (
    | string
    | {
        remoteName: string;
        configuration: string;
      }
  )[];

  skipRemotes?: string[];
  host: string;
  pathToManifestFile?: string;
  staticRemotesPort?: number;
  parallel?: number;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  isInitialHost?: boolean;
  verbose?: boolean;
};

export type NormalizedModuleFederationSsrDevServerOptions =
  ModuleFederationSsrDevServerOptions & {
    devRemotes: DevRemoteDefinition[];
    verbose: boolean;
  };
