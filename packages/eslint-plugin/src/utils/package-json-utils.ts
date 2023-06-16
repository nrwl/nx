import { ProjectFileMap, readJsonFile } from '@nx/devkit';

export function getAllDependencies(path: string) {
  const packageJson = readJsonFile(path);
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };
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
