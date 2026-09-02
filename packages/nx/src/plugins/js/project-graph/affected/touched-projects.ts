import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import type { TouchedProject } from '../../../../project-graph/affected/affected-reasons';
import { getTouchedProjectsFromLockFile } from './lock-file-changes';
import { getTouchedNpmPackages } from './npm-packages';
import { getTouchedProjectsFromTsConfig } from './tsconfig-json-changes';

export const getTouchedProjects: TouchedProjectLocator = (
  touchedFiles,
  nodes,
  nxJson,
  packageJson,
  graph
): TouchedProject[] => {
  const touched: TouchedProject[] = [];
  const seen = new Set<string>();

  for (const locate of [
    getTouchedProjectsFromLockFile,
    getTouchedNpmPackages,
    getTouchedProjectsFromTsConfig,
  ]) {
    for (const reason of locate(
      touchedFiles,
      nodes,
      nxJson,
      packageJson,
      graph
    ) as TouchedProject[]) {
      // Deduped on the whole reason, not the project: one project can be
      // touched by several locators and each is worth reporting.
      const key = `${reason.project}\0${reason.kind}\0${reason.file ?? ''}\0${
        reason.package ?? ''
      }`;
      if (seen.has(key)) continue;
      seen.add(key);
      touched.push(reason);
    }
  }

  return touched;
};
