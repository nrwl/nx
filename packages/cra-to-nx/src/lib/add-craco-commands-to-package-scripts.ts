import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

export function addCracoCommandsToPackageScripts(appName: string) {
  const packageJson = readJsonFile(`apps/${appName}/package.json`);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'craco start',
    serve: 'npm start',
    build: `cross-env BUILD_PATH=../../dist/apps/${appName} craco build`,
    test: 'craco test',
  };
  writeJsonFile(`apps/${appName}/package.json`, packageJson);
}
