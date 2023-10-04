export interface ConfigurationGeneratorSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  compiler?: 'babel' | 'swc' | 'tsc';
  devServer?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipValidation?: boolean;
  target?: 'node' | 'web' | 'webworker';
  webpackConfig?: string;
  babelConfig?: string;
}
