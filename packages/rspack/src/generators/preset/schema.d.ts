export interface PresetGeneratorSchema {
  name: string;
  framework?: Framework;
  less?: boolean;
  sass?: boolean;
  unitTestRunner?: 'none' | 'jest';
  e2eTestRunner?: 'none' | 'cypress';
  directory?: string;
  tags?: string;
  rootProject?: boolean;
  monorepo?: boolean;
}

export interface NormalizedSchema extends PresetGeneratorSchema {
  appProjectRoot: string;
  e2eProjectName: string;
}
