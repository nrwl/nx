import { GitCommit } from '../utils/git.js';
import { FileData, ProjectFileMap } from '../../../config/project-graph.js';
import { NxReleaseConfig } from '../config/config.js';
import { ChangelogChange } from './version-plan-utils.js';

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
  return changes.filter((change) => {
    const type = change.type;

    const typeConfig = conventionalCommitsConfig.types[type];
    if (!typeConfig) {
      // don't include changes with unknown types
      return false;
    }
    return !typeConfig.changelog.hidden;
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
