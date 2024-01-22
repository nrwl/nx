export interface EsBuildProjectSchema {
  project: string;
  main?: string;
  tsConfig?: string;
  devServer?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  skipValidation?: boolean;
  importPath?: string;
  esbuildConfig?: string;
  platform?: 'node' | 'browser' | 'neutral';
  buildTarget?: string;
}
