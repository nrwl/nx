export interface ViteConfigurationGeneratorSchema {
  uiFramework: 'react' | 'none';
  compiler?: 'babel' | 'swc';
  project: string;
  newProject?: boolean;
  includeVitest?: boolean;
  inSourceTests?: boolean;
  includeLib?: boolean;
  buildTarget?: string;
  serveTarget?: string;
  testTarget?: string;
  skipFormat?: boolean;
}
