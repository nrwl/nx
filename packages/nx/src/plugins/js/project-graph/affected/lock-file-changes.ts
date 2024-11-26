import { readNxJson } from '../../../../config/configuration';
import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import { JsonChange } from '../../../../utils/json-diff';
import { jsPluginConfig as readJsPluginConfig } from '../../utils/config';
import { findMatchingProjects } from '../../../../utils/find-matching-projects';

export const getTouchedProjectsFromLockFile: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (fileChanges, projectGraphNodes): string[] => {
  const nxJson = readNxJson();
  const { projectsAffectedByDependencyUpdates } = readJsPluginConfig(nxJson);

  if (projectsAffectedByDependencyUpdates === 'auto') {
    return [];
  } else if (Array.isArray(projectsAffectedByDependencyUpdates)) {
    return findMatchingProjects(
      projectsAffectedByDependencyUpdates,
      projectGraphNodes
    );
  }

  const lockFiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'pnpm-lock.yml',
    'bun.lockb',
  ];

  if (fileChanges.some((f) => lockFiles.includes(f.file))) {
    return Object.values(projectGraphNodes).map((p) => p.name);
  }
  return [];
};
