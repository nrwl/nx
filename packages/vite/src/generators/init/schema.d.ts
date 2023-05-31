export interface InitGeneratorSchema {
  uiFramework: 'react' | 'none';
  compiler?: 'babel' | 'swc';
  includeLib?: boolean;
}
