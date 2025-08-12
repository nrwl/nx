type NgPackagrImportPath = `ng-packagr/src/${string}`;

export function importNgPackagrPath<T>(
  path: NgPackagrImportPath,
  ngPackagrMajorVersion: number
): T {
  let finalPath: string = path;

  if (ngPackagrMajorVersion < 20 && path.startsWith('ng-packagr/src/')) {
    finalPath = path.replace(/^ng-packagr\/src\//, 'ng-packagr/');
  }

  return require(finalPath);
}
