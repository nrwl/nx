export interface WebpackProjectGeneratorSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  compiler?: 'babel' | 'swc' | 'tsc';
  devServer?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  target?: 'node' | 'web';
  webpackConfig?: string;
}
