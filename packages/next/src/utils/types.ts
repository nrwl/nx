import { JsonObject } from '@angular-devkit/core';

export type NextServer = (
  options: NextServerOptions,
  proxyConfig?: ProxyConfig
) => Promise<void>;

export interface ProxyConfig {
  [path: string]: {
    target: string;
    pathRewrite?: any;
    changeOrigin?: boolean;
    secure?: boolean;
  };
}

export interface NextServerOptions {
  dev: boolean;
  dir: string;
  staticMarkup: boolean;
  quiet: boolean;
  conf: any;
  port: number;
  path: string;
  hostname: string;
}

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
  customServerPath?: string;
  hostname?: string;
  proxyConfig?: string;
}

export interface NextExportBuilderOptions extends JsonObject {
  buildTarget: string;
  silent: boolean;
  threads: number;
}
