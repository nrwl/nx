export interface VitestGeneratorSchema {
  project: string;
  uiFramework: 'react' | 'none';
  inSourceTests?: boolean;
  skipViteConfig?: boolean;
}
