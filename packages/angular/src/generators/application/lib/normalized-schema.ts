import type { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  prefix: string; // we set a default for this in normalizeOptions, so it is no longer optional
  appProjectRoot: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
}
