import { ModuleFederationConfig } from '../../utils/models';

export interface NxModuleFederationDevServerConfig {
  host?: string;
  staticRemotesPort?: number;
  pathToManifestFile?: string;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
  parallel?: number;
}
