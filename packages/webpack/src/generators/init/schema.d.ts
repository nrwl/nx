export interface Schema {
  compiler?: 'babel' | 'swc' | 'tsc';
  uiFramework?: 'react' | 'none';
  skipFormat?: boolean;
}
