import { readJsonFile, writeJsonFile } from 'nx/src/utils/fileutils';

export function addViteCommandsToPackageScripts(appName: string) {
  const packageJson = readJsonFile(`apps/${appName}/package.json`);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'vite',
    serve: 'vite',
    build: `vite build`,
    test: 'vitest',
  };
  writeJsonFile(`apps/${appName}/package.json`, packageJson, { spaces: 2 });
}
