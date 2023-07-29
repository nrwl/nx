export interface Schema {
  skipFormat?: boolean;
  skipPackageJson?: boolean; //default is false
  framework?: 'react-native' | 'expo';
}
