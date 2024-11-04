import { type DevRemoteDefinition } from '../../builders/utilities/module-federation';

export interface Schema {
  browserTarget: string;
  serverTarget: string;
  host?: string;
  port?: number;
  progress: boolean;
  open?: boolean;
  publicHost?: string;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
  devRemotes?: DevRemoteDefinition[];
  skipRemotes?: string[];
  verbose: boolean;
  pathToManifestFile?: string;
  parallel?: number;
  staticRemotesPort?: number;
  parallel?: number;
  isInitialHost?: boolean;
}
