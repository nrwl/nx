export interface CopyAssetsExecutorSchema {
  assets: Array<
    | string
    | {
        input: string;
        glob: string;
        output: string;
        ignore?: string[];
        includeIgnoredFiles?: boolean;
      }
  >;
  outputPath: string;
}
