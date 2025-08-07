export interface ApplicationGeneratorSchema {
  directory: string;
  name?: string;
  framework?: Framework;
  style: 'css' | 'scss' | 'less';
  unitTestRunner?: 'none' | 'jest';
  e2eTestRunner?: 'none' | 'cypress';
  tags?: string;
  rootProject?: boolean;
  monorepo?: boolean;
}

export interface NormalizedSchema extends ApplicationGeneratorSchema {
  appProjectRoot: string;
  e2eProjectName: string;
}
