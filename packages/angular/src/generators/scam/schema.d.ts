export interface Schema {
  path: string;
  name?: string;
  displayBlock?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'None' | 'ShadowDom';
  changeDetection?: 'Default' | 'OnPush';
  style?: 'css' | 'scss' | 'sass' | 'less' | 'none';
  skipTests?: boolean;
  inlineScam?: boolean;
  type?: string;
  prefix?: string;
  selector?: string;
  skipSelector?: boolean;
  export?: boolean;
  skipFormat?: boolean;
}

export interface NormalizedSchema extends Schema {
  name: string;
  directory: string;
  projectName: string;
  fileName: string;
  filePath: string;
  symbolName: string;
  export: boolean;
  inlineScam: boolean;
  modulePath: string;
}
