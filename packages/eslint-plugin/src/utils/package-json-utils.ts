import { PackageJson, ProjectFileMap, readJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';

export function getAllDependencies(
  packageJson: PackageJson
): Record<string, string> {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };
}

export function getPackageJson(path: string): PackageJson {
  if (existsSync(path)) {
    return readJsonFile(path);
  }
  return {} as PackageJson;
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
