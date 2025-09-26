import {
  JavaScriptTransformer,
  SourceFileCache,
  AngularCompilation,
  createAngularCompilation,
} from '@angular/build/private';

export {
  JavaScriptTransformer,
  SourceFileCache,
  AngularCompilation,
  createAngularCompilation,
};

export * from './inline-style-language';
export * from './file-replacement';
export * from './style-preprocessor-options';

export enum DiagnosticModes {
  None = 0,
  Option = 1 << 0,
  Syntactic = 1 << 1,
  Semantic = 1 << 2,
  All = Option | Syntactic | Semantic,
}

export interface Location {
  file: string;
  namespace: string;
  line: number;
  column: number;
  length: number;
  lineText: string;
  suggestion: string;
}

export interface PartialNote {
  text?: string;
  location?: Partial<Location> | null;
}

export interface PartialMessage {
  id?: string;
  pluginName?: string;
  text?: string;
  location?: Partial<Location> | null;
  notes?: PartialNote[];
  detail?: never;
}
