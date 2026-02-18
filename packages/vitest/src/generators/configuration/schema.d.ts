export interface VitestGeneratorSchema {
  project: string;
  uiFramework?: 'angular' | 'react' | 'vue' | 'none';
  coverageProvider: 'v8' | 'istanbul' | 'custom';
  inSourceTests?: boolean;
  skipViteConfig?: boolean;
  testTarget?: string;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
  addPlugin?: boolean;
  runtimeTsconfigFileName?: string;
  compiler?: 'babel' | 'swc'; // default: babel
  // internal options
  projectType?: 'application' | 'library';
  viteVersion?: 5 | 6 | 7;
}
