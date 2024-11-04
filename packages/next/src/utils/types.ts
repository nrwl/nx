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
  port: number;
  hostname: string;
  customServer?: boolean;
}

export interface FileReplacement {
  replace: string;
  with: string;
}

export interface NextBuildBuilderOptions {
  assets?: any[];
  buildLibsFromSource?: boolean;
  debug?: boolean;
  experimentalAppOnly?: boolean;
  experimentalBuildMode?: 'compile' | 'generate';
  fileReplacements: FileReplacement[];
  generateLockfile?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  nextConfig?: string;
  outputPath: string;
  profile?: boolean;
  skipOverrides?: boolean;
  skipPackageManager?: boolean;
  watch?: boolean;
}

export interface NextServeBuilderOptions {
  dev: boolean;
  port: number;
  staticMarkup: boolean;
  quiet: boolean;
  buildTarget: string;
  customServerTarget?: string;
  hostname?: string;
  buildLibsFromSource?: boolean;
  keepAliveTimeout?: number;
  turbo?: boolean;
  experimentalHttps?: boolean;
  experimentalHttpsKey?: string;
  experimentalHttpsCert?: string;
  experimentalHttpsCa?: string;
  customServerHttps?: boolean;
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
