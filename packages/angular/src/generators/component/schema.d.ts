export interface Schema {
  name: string;
  path?: string;
  project?: string;
  displayBlock?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  standalone?: boolean;
  viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
  changeDetection?: 'Default' | 'OnPush';
  style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
  skipTests?: boolean;
  type?: string;
  flat?: boolean;
  skipImport?: boolean;
  selector?: string;
  module?: string;
  skipSelector?: boolean;
  export?: boolean;
}

export interface NormalizedSchema extends Schema {
  path: string;
  project: string;
  projectSourceRoot: string;
}
