export type AssetPattern =
  | string
  | {
      followSymlinks?: boolean;
      glob: string;
      input: string;
      ignore?: string[];
      output?: string;
    };

export interface LibraryExecutorOptions {
  tsConfig: string;
  outputPath: string;
  assets?: AssetPattern[];
  inlineStyleLanguage?: 'css' | 'less' | 'sass' | 'scss';
  stylePreprocessorOptions?: {
    includePaths?: string[];
    sass?: {
      fatalDeprecations?: string[];
      silenceDeprecations?: string[];
      futureDeprecations?: string[];
    };
  };
  declarationMap?: boolean;
  compilationMode?: 'partial' | 'full';
  allowedNonPeerDependencies?: string[];
  keepLifecycleScripts?: boolean;
  deleteOutputPath?: boolean;
  watch?: boolean;
  poll?: number;
  preserveSymlinks?: boolean;
  progress?: boolean;
  clearScreen?: boolean;
}
