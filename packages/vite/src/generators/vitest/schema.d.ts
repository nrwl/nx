export interface VitestGeneratorSchema {
  project: string;
  uiFramework: 'react' | 'none';
  coverageProvider: 'c8' | 'istanbul';
  inSourceTests?: boolean;
  skipViteConfig?: boolean;
  testTarget?: string;
  skipFormat?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
}
