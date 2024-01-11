export interface InitSchema {
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  routing?: boolean;
  style?: 'css' | 'scss' | 'less' | 'none';
}
