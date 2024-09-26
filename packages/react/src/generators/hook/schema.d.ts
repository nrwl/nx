export interface Schema {
  path: string;
  name?: string;
  skipTests?: boolean;
  directory?: string;
  export?: boolean;
  js?: boolean;
  nameAndDirectoryFormat?: NameAndDirectoryFormat;
}
