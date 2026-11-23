import type { LinterType } from '@nx/js';
import { Schema } from '../schema';

export interface NormalizedSchema extends Omit<Schema, 'useTsSolution'> {
  name: string;
  bundler: NonNullable<Schema['bundler']>;
  appProjectRoot: string;
  parsedTags: string[];
  outputPath: string;
  buildTargetName: string;
  /** Runs the main file for an inferred `serve`; unset means an explicit @nx/js:node serve. */
  serveRuntime?: 'node' | 'tsx';
  importPath: string;
  linter: LinterType;
  port: number;
  isUsingTsSolutionConfig: boolean;
}
