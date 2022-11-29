import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

export function addCracoCommandsToPackageScripts(
  appName: string,
  isNested: boolean
) {
  const packageJsonPath = isNested
    ? 'package.json'
    : `apps/${appName}/package.json`;
  const distPath = isNested ? 'dist' : `../../dist/apps/${appName}`;
  const packageJson = readJsonFile(packageJsonPath);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'nx exec -- craco start',
    serve: 'npm start',
    build: `cross-env BUILD_PATH=${distPath} nx exec -- craco build`,
    test: 'nx exec -- craco test',
  };
  writeJsonFile(packageJsonPath, packageJson);
}
