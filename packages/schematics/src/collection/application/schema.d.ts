export interface Schema {
  name: string;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  routing?: boolean;
  prefix?: string;
  style?: string;
  skipTests?: boolean;
  directory?: string;
  tags?: string;
}
