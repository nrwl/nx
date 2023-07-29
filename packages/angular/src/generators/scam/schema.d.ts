export interface Schema {
  name: string;
  project: string;
  path?: string;
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
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  fileName: string;
  filePath: string;
  export: boolean;
  inlineScam: boolean;
}
