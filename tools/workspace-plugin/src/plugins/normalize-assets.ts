import * as path from 'node:path';
import { posix } from 'node:path';

export interface NormalizedEntry {
  isGlob: boolean;
  pattern: string;
  input: string;
  output: string;
}

export function normalizeAssets(
  assets: (
    | { input: string; glob: string; output: string; ignore?: string[] }
    | string
  )[],
  rootDir: string,
  projectDir: string,
  outputDir: string
): NormalizedEntry[] {
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
      };
    }
    return {
      isGlob: true,
      pattern: posix.join(f.input, f.glob),
      input: f.input,
      output: posix.join(path.relative(rootDir, resolvedOutputDir), f.output),
    };
  });
}

export function getAssetOutputPath(
  src: string,
  entry: NormalizedEntry
): string {
  const relPath = path.relative(entry.input, src);
  const dest = relPath.startsWith('..') ? src : relPath;
  return posix.join(entry.output, dest);
}
