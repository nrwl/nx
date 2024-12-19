import { DevRemoteDefinition } from '@nx/module-federation/src/executors/utils';
import { RspackSsrDevServerOptions } from '../ssr-dev-server/schema';

export type ModuleFederationSsrDevServerOptions = RspackSsrDevServerOptions & {
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
