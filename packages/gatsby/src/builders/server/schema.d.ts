import { JsonObject } from '@angular-devkit/core';

export interface GatsbyPluginBuilderSchema extends JsonObject {
  buildTarget: string;
  host: string;
  port: string;
  open: boolean;
  https: boolean;
}
