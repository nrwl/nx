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
    // These should be replaced by the vite init generator later.
    start: 'vite',
    test: 'vitest',
    dev: 'vite',
    build: 'vite build',
    eject: undefined,
  };
  writeJsonFile(packageJsonPath, packageJson, { spaces: 2 });
}
