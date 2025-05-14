export interface Schema {
  project: string;
  appComponentImportPath?: string;
  serverPort?: number;
  skipFormat?: boolean;
  extraInclude?: string[];
  bundler?: 'rspack' | 'webpack';
}
