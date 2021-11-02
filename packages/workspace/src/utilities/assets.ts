import { logger } from '@nrwl/devkit';
import { copy } from 'fs-extra';
import * as glob from 'glob';
import { basename, join } from 'path';

export type FileInputOutput = {
  input: string;
  output: string;
};
export type AssetGlob = FileInputOutput & {
  glob: string;
  ignore: string[];
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
    return glob.sync(pattern, {
      cwd: input,
      nodir: true,
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

export function copyAssets(
  assets: Array<AssetGlob | string>,
  rootDir: string,
  outDir: string
): Promise<{ success: boolean; error?: string }> {
  const files = assetGlobsToFiles(assets, rootDir, outDir);
  return copyAssetFiles(files);
}

export async function copyAssetFiles(
  files: FileInputOutput[]
): Promise<{ success: boolean; error?: string }> {
  logger.info('Copying asset files...');
  try {
    await Promise.all(files.map((file) => copy(file.input, file.output)));
    logger.info('Done copying asset files.');
    return { success: true };
  } catch (err) {
    return { error: err.message, success: false };
  }
}
