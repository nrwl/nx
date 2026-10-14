import { Schema } from '../schema';

export interface NormalizedSchema extends Omit<Schema, 'useTsSolution'> {
  appProjectRoot: string;
  parsedTags: string[];
  outputPath: string;
  buildTargetName: string;
  /** Runs the main file for an inferred `serve`; unset means an explicit @nx/js:node serve. */
  serveRuntime?: 'node' | 'tsx';
  importPath: string;
  isUsingTsSolutionConfig: boolean;
}
