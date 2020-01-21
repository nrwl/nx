import { JsonObject } from '@angular-devkit/core';

export interface FileReplacement extends JsonObject {
  replace: string;
  with: string;
}

export interface NextBuildBuilderOptions extends JsonObject {
  root: string;
  outputPath: string;
  fileReplacements: FileReplacement[];
}

export interface NextServeBuilderOptions extends JsonObject {
  dev: boolean;
  port: number;
  staticMarkup: boolean;
  quiet: boolean;
  buildTarget: string;
  customServerPath: string;
  hostname: string;
}

export interface NextExportBuilderOptions extends JsonObject {
  buildTarget: string;
  silent: boolean;
  threads: number;
}
