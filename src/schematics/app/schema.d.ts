export interface Schema {
  name: string;
  directory?: string;
  sourceDir?: string;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: ('Emulated'|'Native'|'None');
  changeDetection?: ('Default'|'OnPush');
  prefix?: string;
  style?: string;
  skipTests?: boolean;
  routing?: boolean;
}
