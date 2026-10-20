import { Schema } from '../schema';

export interface NormalizedSchema extends Omit<Schema, 'useTsSolution'> {
  appProjectRoot: string;
  parsedTags: string[];
  outputPath: string;
  buildTargetName: string;
  /** Runs the main file from source for `serve`; unset means an @nx/js:node serve. */
  serveRuntime?: 'node' | 'tsx';
  importPath: string;
  isUsingTsSolutionConfig: boolean;
}
