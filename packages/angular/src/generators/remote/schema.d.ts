export interface Schema {
  name: string;
  host?: string;
  port?: number;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  addTailwind?: boolean;
  prefix?: string;
  style?: Styles;
  skipTests?: boolean;
  directory?: string;
  tags?: string;
  linter?: AngularLinter;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  standaloneConfig?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  skipFormat?: boolean;
}
