export interface Schema {
  name: string;
  path?: string;
  project?: string;
  displayBlock?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
  changeDetection?: 'Default' | 'OnPush';
  style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
  skipTests?: boolean;
  inlineScam?: boolean;
  type?: string;
  flat?: boolean;
  prefix?: string;
  selector?: string;
  skipSelector?: boolean;
  export?: boolean;
}

export interface NormalizedSchema extends Schema {
  export: boolean;
  inlineScam: boolean;
  path: string;
  project: string;
  projectSourceRoot: string;
}
