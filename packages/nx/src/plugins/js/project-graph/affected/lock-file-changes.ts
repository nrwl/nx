import { TouchedProjectLocator } from '../../../../project-graph/affected/affected-project-graph-models';
import { WholeFileChange } from '../../../../project-graph/file-utils';
import { JsonChange } from '../../../../utils/json-diff';

export const getTouchedProjectsFromLockFile: TouchedProjectLocator<
  WholeFileChange | JsonChange
> = (fileChanges, projectGraphNodes): string[] => {
  const lockFiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'pnpm-lock.yml',
  ];

  if (fileChanges.some((f) => lockFiles.includes(f.file))) {
    return Object.values(projectGraphNodes).map((p) => p.name);
  }
  return [];
};
