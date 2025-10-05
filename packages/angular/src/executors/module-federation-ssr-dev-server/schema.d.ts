import { type DevRemoteDefinition } from '../../builders/utilities/module-federation';
import type { SSRDevServerBuilderOptions } from '@angular-devkit/build-angular';

export interface Schema extends SSRDevServerBuilderOptions {
  devRemotes?: DevRemoteDefinition[];
  skipRemotes?: string[];
  pathToManifestFile?: string;
  parallel?: number;
  staticRemotesPort?: number;
  isInitialHost?: boolean;
}

export interface NormalizedSchema extends Schema {
  devRemotes: DevRemoteDefinition[];
  ssl: boolean;
  verbose: boolean;
}
