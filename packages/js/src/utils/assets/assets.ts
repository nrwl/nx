import * as fastGlob from 'fast-glob';
import { basename, join } from 'path';

export type FileInputOutput = {
  input: string;
  output: string;
};
export type AssetGlob = FileInputOutput & {
  glob: string;
  ignore?: string[];
  dot?: boolean;
};

export function assetGlobsToFiles(
  assets: Array<AssetGlob | string>,
  rootDir: string,
  outDir: string
): FileInputOutput[] {
  const files: FileInputOutput[] = [];

  const globbedFiles = (
    pattern: string,
    input = '',
    ignore: string[] = [],
    dot: boolean = false
  ) => {
    return fastGlob.sync(pattern, {
      cwd: input,
      onlyFiles: true,
      dot,
      ignore,
    });
  };

  assets.forEach((asset) => {
    if (typeof asset === 'string') {
      globbedFiles(asset, rootDir).forEach((globbedFile) => {
        files.push({
          input: join(rootDir, globbedFile),
          output: join(outDir, basename(globbedFile)),
        });
      });
    } else {
      globbedFiles(
        asset.glob,
        join(rootDir, asset.input),
        asset.ignore,
        asset.dot ?? false
      ).forEach((globbedFile) => {
        files.push({
          input: join(rootDir, asset.input, globbedFile),
          output: join(outDir, asset.output, globbedFile),
        });
      });
    }
  });

  return files;
}
