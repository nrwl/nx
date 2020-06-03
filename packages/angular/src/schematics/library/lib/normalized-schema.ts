import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  entryFile: string;
  modulePath: string;
  moduleName: string;
  projectDirectory: string;
  parsedTags: string[];
}
