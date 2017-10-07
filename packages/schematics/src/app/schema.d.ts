export interface Schema {
  name: string;
  sourceDir?: string;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  changeDetection?: 'Default' | 'OnPush';
  routing?: boolean;
  skipTests?: boolean;
  prefix?: string;
  style?: string;
}
