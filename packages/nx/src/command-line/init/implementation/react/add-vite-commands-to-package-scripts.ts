import { readJsonFile, writeJsonFile } from '../../../../utils/fileutils';

export function addViteCommandsToPackageScripts(
  appName: string,
  isStandalone: boolean
) {
  const packageJsonPath = isStandalone
    ? 'package.json'
    : `apps/${appName}/package.json`;
  const packageJson = readJsonFile(packageJsonPath);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'nx exec -- vite',
    serve: 'nx exec -- vite',
    build: `nx exec -- vite build`,
    test: 'nx exec -- vitest',
  };
  writeJsonFile(packageJsonPath, packageJson, { spaces: 2 });
}
