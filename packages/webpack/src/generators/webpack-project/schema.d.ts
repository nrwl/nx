export interface WebpackProjectGeneratorSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  compiler?: 'babel' | 'swc';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  target?: 'node' | 'web';
  webpackConfig?: string;
}
