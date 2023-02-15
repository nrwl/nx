export interface InitGeneratorSchema {
  uiFramework?: 'none' | 'react' | 'web';
  style?: 'none' | 'css' | 'scss' | 'less';
  devServer?: boolean;
}
