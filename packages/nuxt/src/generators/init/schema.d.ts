export interface InitSchema {
  skipFormat: boolean;
  skipPackageJson?: boolean;
  rootProject?: boolean;
  style?: 'css' | 'scss' | 'less' | 'none';
}
