import { Schema } from './schema';

export interface NormalizedSchema extends Schema {
  projectSourceRoot: string;
  fileName: string;
  className: string;
  styledModule: null | string;
  hasStyles: boolean;
}
