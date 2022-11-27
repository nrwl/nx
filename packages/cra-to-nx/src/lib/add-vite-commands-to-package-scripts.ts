import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

export function addViteCommandsToPackageScripts(
  appName: string,
  isNested: boolean
) {
  const packageJsonPath = isNested
    ? 'package.json'
    : `apps/${appName}/package.json`;
  const packageJson = readJsonFile(packageJsonPath);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'vite',
    serve: 'vite',
    build: `vite build`,
    test: 'vitest',
  };
  writeJsonFile(packageJsonPath, packageJson, { spaces: 2 });
}
