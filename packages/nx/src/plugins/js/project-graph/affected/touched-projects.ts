import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models.js';
import { getTouchedProjectsFromLockFile } from './lock-file-changes.js';
import { getTouchedNpmPackages } from './npm-packages.js';
import { getTouchedProjectsFromTsConfig } from './tsconfig-json-changes.js';

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
