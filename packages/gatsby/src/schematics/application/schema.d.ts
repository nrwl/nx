export interface GatsbyPluginSchematicSchema {
  name: string;
  tags?: string;
  style: string;
  directory?: string;
  unitTestRunner: 'jest' | 'none';
  e2eTestRunner: 'cypress' | 'none';
  js: boolean;
}
