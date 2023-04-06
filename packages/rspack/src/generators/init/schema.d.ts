export type Framework = 'none' | 'react' | 'web' | 'nest';

export interface InitGeneratorSchema {
  framework?: Framework;
  style?: 'none' | 'css' | 'scss' | 'less';
  devServer?: boolean;
}
