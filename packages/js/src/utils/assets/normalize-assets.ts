import * as path from 'node:path';
import * as pathPosix from 'node:path/posix';

export interface AssetGlobInput {
  input: string;
  output: string;
  glob: string;
  ignore?: string[];
  includeIgnoredFiles?: boolean;
}

export interface NormalizedAssetEntry {
  isGlob: boolean;
  pattern: string;
  ignore: string[] | null;
  input: string;
  output: string;
  includeIgnoredFiles?: boolean;
}

/**
 * Normalize raw asset definitions (strings or objects) into resolved
 * entries with computed input, output, and pattern fields.
 */
export function normalizeAssets(
  assets: (string | AssetGlobInput)[],
  rootDir: string,
  projectDir: string,
  outputDir: string
): NormalizedAssetEntry[] {
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.resolve(rootDir, outputDir);

  return assets.map((f) => {
    if (typeof f === 'string') {
      return {
        isGlob: false,
        pattern: f,
        input: path.relative(rootDir, projectDir),
        output: path.relative(rootDir, resolvedOutputDir),
        ignore: null,
        includeIgnoredFiles: undefined,
      };
    }
    return {
      isGlob: true,
      pattern: pathPosix.join(f.input, f.glob),
      input: f.input,
      output: pathPosix.join(
        path.relative(rootDir, resolvedOutputDir),
        f.output
      ),
      ignore: f.ignore
        ? f.ignore.map((ig) => pathPosix.join(f.input, ig))
        : null,
      includeIgnoredFiles: f.includeIgnoredFiles,
    };
  });
}

/**
 * Compute the output path for a file given its asset entry,
 * matching the dest logic used during file copying.
 */
export function getAssetOutputPath(
  src: string,
  assetEntry: NormalizedAssetEntry
): string {
  const relPath = path.relative(assetEntry.input, src);
  const dest = relPath.startsWith('..') ? src : relPath;
  return pathPosix.join(assetEntry.output, dest);
}
