import { Schema } from '../schema';

export interface NormalizedSchema extends Omit<Schema, 'useTsSolution'> {
  appProjectRoot: string;
  parsedTags: string[];
  outputPath: string;
  importPath: string;
  isUsingTsSolutionConfig: boolean;
}
