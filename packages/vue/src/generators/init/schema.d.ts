export interface InitSchema {
  skipFormat?: boolean;
  js?: boolean;
  rootProject?: boolean;
  routing?: boolean;
  style?: 'css' | 'scss' | 'less' | 'none';
}
