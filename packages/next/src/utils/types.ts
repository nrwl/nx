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

export interface FileReplacement {
  replace: string;
  with: string;
}

export interface NextBuildBuilderOptions {
  root: string;
  outputPath: string;
  fileReplacements: FileReplacement[];
  assets?: any[];
  nextConfig?: string;
  buildLibsFromSource?: boolean;
}

export interface NextServeBuilderOptions {
  dev: boolean;
  port: number;
  staticMarkup: boolean;
  quiet: boolean;
  buildTarget: string;
  customServerPath?: string;
  hostname?: string;
  proxyConfig?: string;
  buildLibsFromSource?: boolean;
}

export interface NextExportBuilderOptions {
  buildTarget: string;
  silent: boolean;
  threads: number;
  buildLibsFromSource?: boolean;
}

export interface WebpackConfigOptions {
  svgr?: boolean;
}
