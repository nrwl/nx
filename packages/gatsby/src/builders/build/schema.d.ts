import { JsonObject } from '@angular-devkit/core';

export interface GatsbyPluginBuilderSchema extends JsonObject {
  prefixPaths?: boolean;
  uglify: boolean;
  profile?: boolean;
  openTracingConfigFile?: string;
  graphqlTracing?: boolean;
  color: boolean;
}
