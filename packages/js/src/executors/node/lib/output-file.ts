import * as path from 'path';

interface OutputFileNameOptions {
  buildTargetExecutor: string;
  main: string;
  outputPath: string;
  projectRoot: string;
}

export function getOutputFileName({
  buildTargetExecutor,
  main,
  outputPath,
  projectRoot,
}: OutputFileNameOptions): string {
  const fileName = `${path.parse(main).name}.js`;

  if (
    buildTargetExecutor !== '@nx/js:tsc' &&
    buildTargetExecutor !== '@nx/js:swc'
  ) {
    return fileName;
  }

  const relativeDirectory = getRelativeDirectoryForOutputFile(
    main,
    outputPath,
    projectRoot
  );

  return path.join(relativeDirectory, fileName);
}

function getRelativeDirectoryForOutputFile(
  main: string,
  outputPath: string,
  projectRoot: string
): string {
  const mainDirectory = normalizePath(path.dirname(main));
  const normalizedOutputPath = normalizePath(outputPath);

  if (
    mainDirectory === normalizedOutputPath ||
    mainDirectory.startsWith(`${normalizedOutputPath}/`)
  ) {
    const relativeToOutputPath = normalizePath(
      path.relative(normalizedOutputPath, mainDirectory)
    );

    return relativeToOutputPath === '' ? './' : `./${relativeToOutputPath}/`;
  }

  return getRelativeDirectoryToProjectRoot(main, projectRoot);
}

function getRelativeDirectoryToProjectRoot(
  file: string,
  projectRoot: string
): string {
  const directory = path.dirname(file);
  const relativeDirectory = normalizePath(
    path.relative(projectRoot, directory)
  );

  return relativeDirectory === '' ? './' : `./${relativeDirectory}/`;
}

function normalizePath(osSpecificPath: string): string {
  return osSpecificPath
    .replace(/^[a-zA-Z]:/, '')
    .split('\\')
    .join('/');
}
