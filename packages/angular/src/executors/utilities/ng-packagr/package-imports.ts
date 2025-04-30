export function importNgPackagrPath<T>(
  path: string,
  ngPackagrMajorVersion: number
): T {
  let finalPath = path;

  if (ngPackagrMajorVersion >= 20 && !path.startsWith('ng-packagr/src/')) {
    finalPath = path.replace(/^ng-packagr\//, 'ng-packagr/src/');
  }

  return require(finalPath);
}
