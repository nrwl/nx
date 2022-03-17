import { readJsonSync, writeJsonSync } from 'fs-extra';

export function addCRAcracoScriptsToPackageJson(appName: string) {
  const packageJson = readJsonSync(`apps/${appName}/package.json`);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'craco start',
    serve: 'npm start',
    build: `BUILD_PATH=../../dist/apps/${appName} craco build`,
    test: 'craco test',
  };
  writeJsonSync(`apps/${appName}/package.json`, packageJson, { spaces: 2 });
}
