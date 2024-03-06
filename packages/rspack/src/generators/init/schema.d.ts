export type Framework = 'none' | 'react' | 'web' | 'nest';

export interface InitGeneratorSchema {
  framework?: Framework;
  style?: 'none' | 'css' | 'scss' | 'less' | 'styl';
  devServer?: boolean;
  rootProject?: boolean;
  keepExistingVersions?: boolean;
}
