import { dirname, parse } from 'path';
import { joinPathFragments, normalizePath } from 'nx/src/utils/path';
import { getRelativeDirectoryToProjectRoot } from '../../../utils/get-main-file-dir';

interface OutputFileNameOptions {
  buildTargetExecutor: string;
  main: string;
  outputPath: string;
  rootDir: string;
}

export function getOutputFileName({
  buildTargetExecutor,
  main,
  outputPath,
  rootDir,
}: OutputFileNameOptions): string {
  const fileName = `${parse(main).name}.js`;

  if (
    buildTargetExecutor !== '@nx/js:tsc' &&
    buildTargetExecutor !== '@nx/js:swc'
  ) {
    return fileName;
  }

  const mainDirectory = normalizePath(dirname(main));
  const normalizedOutputPath = normalizePath(outputPath);
  const isMainInsideOutputPath =
    mainDirectory === normalizedOutputPath ||
    mainDirectory.startsWith(`${normalizedOutputPath}/`);
  const base = isMainInsideOutputPath ? normalizedOutputPath : rootDir;

  return joinPathFragments(
    getRelativeDirectoryToProjectRoot(main, base),
    fileName
  );
}
