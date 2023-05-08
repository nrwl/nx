import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';

export function addCracoCommandsToPackageScripts(
  appName: string,
  isStandalone: boolean
) {
  const packageJsonPath = isStandalone
    ? 'package.json'
    : `apps/${appName}/package.json`;
  const distPath = isStandalone
    ? `dist/${appName}`
    : `../../dist/apps/${appName}`;
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
