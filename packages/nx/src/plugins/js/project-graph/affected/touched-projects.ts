import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import { getTouchedProjectsFromLockFile } from './lock-file-changes';
import { getTouchedNpmPackages } from './npm-packages';
import { getTouchedProjectsFromTsConfig } from './tsconfig-json-changes';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  nodes,
  nxJson,
  packageJson,
  graph
): string[] => {
  const touchedProjects = new Set<string>();

  [
    getTouchedProjectsFromLockFile,
    getTouchedNpmPackages,
    getTouchedProjectsFromTsConfig,
  ].forEach((fn) => {
    (fn(touchedFiles, nodes, nxJson, packageJson, graph) as string[]).forEach(
      (p) => touchedProjects.add(p)
    );
  });

  return Array.from(touchedProjects);
};
