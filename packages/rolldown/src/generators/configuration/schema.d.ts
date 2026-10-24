export interface Schema {
  project: string;
  main?: string;
  outputPath?: string;
  tsConfig?: string;
  format?: 'esm' | 'cjs';
  platform?: 'node' | 'browser' | 'neutral';
  externalDependencies?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
}
