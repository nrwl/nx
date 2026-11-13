import { GitCommit } from '../utils/git';
import { FileData, ProjectFileMap } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { ChangelogChange } from './version-plan-utils';

export function mapCommitToChange(
  commit: GitCommit,
  affectedProjects: string[] | '*'
): ChangelogChange {
  return {
    type: commit.type,
    scope: commit.scope,
    description: commit.description,
    body: commit.body,
    isBreaking: commit.isBreaking,
    githubReferences: commit.references,
    authors: commit.authors,
    shortHash: commit.shortHash,
    revertedHashes: commit.revertedHashes,
    affectedProjects,
  };
}

export function createChangesFromCommits(
  commits: GitCommit[],
  fileMap: { projectFileMap: ProjectFileMap; nonProjectFiles: FileData[] },
  fileToProjectMap: Record<string, string>,
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): ChangelogChange[] {
  return filterHiddenChanges(
    commits.map((c) => {
      const affectedProjects = commitChangesNonProjectFiles(
        c,
        fileMap.nonProjectFiles
      )
        ? '*'
        : getProjectsAffectedByCommit(c, fileToProjectMap);
      return mapCommitToChange(c, affectedProjects);
    }),
    conventionalCommitsConfig
  );
}

export function filterHiddenChanges(
  changes: ChangelogChange[],
  conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']
): ChangelogChange[] {
  // The changelog renderer drops a change together with its revert, but it
  // never sees a hidden revert, so drop the change such a revert undoes here.
  // Changes are newest first, so a revert comes before the change it undoes.
  const hiddenRevertedHashes: string[] = [];
  return changes.filter((change) => {
    if (
      change.shortHash &&
      hiddenRevertedHashes.some((hash) => hash.startsWith(change.shortHash))
    ) {
      return false;
    }

    const type = change.type;

    const typeConfig = conventionalCommitsConfig.types[type];
    // don't include changes with unknown types
    const isHidden = !typeConfig || typeConfig.changelog.hidden;
    if (isHidden && change.revertedHashes?.length) {
      hiddenRevertedHashes.push(...change.revertedHashes);
    }
    return !isHidden;
  });
}

export function getProjectsAffectedByCommit(
  commit: GitCommit,
  fileToProjectMap: Record<string, string>
): string[] {
  const affectedProjects = new Set<string>();
  for (const affectedFile of commit.affectedFiles) {
    const affectedProject = fileToProjectMap[affectedFile];
    if (affectedProject) {
      affectedProjects.add(affectedProject);
    }
  }
  return Array.from(affectedProjects);
}

export function commitChangesNonProjectFiles(
  commit: GitCommit,
  nonProjectFiles: FileData[]
): boolean {
  return nonProjectFiles.some((fileData) =>
    commit.affectedFiles.includes(fileData.file)
  );
}

export function createFileToProjectMap(
  projectFileMap: ProjectFileMap
): Record<string, string> {
  const fileToProjectMap = {};
  for (const [projectName, projectFiles] of Object.entries(projectFileMap)) {
    for (const file of projectFiles) {
      fileToProjectMap[file.file] = projectName;
    }
  }
  return fileToProjectMap;
}
