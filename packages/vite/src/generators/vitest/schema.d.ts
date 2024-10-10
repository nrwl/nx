export interface VitestGeneratorSchema {
  project: string;
  uiFramework: 'react' | 'none';
  coverageProvider: 'v8' | 'istanbul' | 'custom';
  inSourceTests?: boolean;
  skipViteConfig?: boolean;
  testTarget?: string;
  skipFormat?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
  addPlugin?: boolean;
  runtimeTsconfigFileName?: string;
  compiler?: 'babel' | 'swc'; // default: babel
}
