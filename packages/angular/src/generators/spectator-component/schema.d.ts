import { Schema as AngularComponentSchema } from '../component/schema';

export interface Schema extends AngularComponentSchema {
  withHost?: boolean;
  withCustomHost?: boolean;
  jest?: boolean;
}

export interface NormalizedSchema extends Schema {
  directory: string;
  filePath: string;
  projectSourceRoot: string;
  projectRoot: string;
  selector: string;
  withHost: boolean;
  withCustomHost: boolean;
  jest: boolean;
}
