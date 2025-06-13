export interface ViteConfigurationGeneratorSchema {
  uiFramework: 'react' | 'none';
  compiler?: 'babel' | 'swc';
  project: string;
  newProject?: boolean;
  includeVitest?: boolean;
  inSourceTests?: boolean;
  includeLib?: boolean;
  skipFormat?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
  port?: number;
  // Internal options
  addPlugin?: boolean;
  projectType?: 'application' | 'library';
  previewPort?: number;
}
