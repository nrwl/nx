import { ProjectFileMap, readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';

export function getAllDependencies(path: string): Record<string, string> {
  if (existsSync(path)) {
    const packageJson = readJsonFile(path);
    return {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };
  }
  return {};
}

export function removePackageJsonFromFileMap(
  projectFileMap: ProjectFileMap
): ProjectFileMap {
  const newFileMap = {};
  Object.keys(projectFileMap).forEach((key) => {
    newFileMap[key] = projectFileMap[key].filter(
      (f) => !f.file.endsWith('/package.json')
    );
  });
  return newFileMap;
}
