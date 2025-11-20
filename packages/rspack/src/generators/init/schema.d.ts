export type Framework = 'none' | 'react' | 'web' | 'nest' | 'angular';

export interface InitGeneratorSchema {
  addPlugin?: boolean;
  devServer?: boolean;
  framework?: Framework;
  keepExistingVersions?: boolean;
  rootProject?: boolean;
  style?: 'none' | 'css' | 'scss' | 'less';
  updatePackageScripts?: boolean;
}
