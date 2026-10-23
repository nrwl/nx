import { GitCommit } from "../utils/git";
import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
} from "../../../config/project-graph";
import { NxReleaseConfig } from "../config/config";
import { ChangelogChange } from "./version-plan-utils";

export function mapCommitToChange(
  commit: GitCommit,
  affectedProjects: string[] | "*",
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
  conventionalCommitsConfig: NxReleaseConfig["conventionalCommits"],
): ChangelogChange[] {
  return filterHiddenChanges(
    commits.map((c) => {
      const affectedProjects = commitChangesNonProjectFiles(
        c,
        fileMap.nonProjectFiles,
      )
        ? "*"
        : getProjectsAffectedByCommit(c, fileToProjectMap);
      return mapCommitToChange(c, affectedProjects);
    }),
    conventionalCommitsConfig,
  );
}

export function filterHiddenChanges(
  changes: ChangelogChange[],
  conventionalCommitsConfig: NxReleaseConfig["conventionalCommits"],
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
  fileToProjectMap: Record<string, string>,
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
  nonProjectFiles: FileData[],
): boolean {
  return nonProjectFiles.some((fileData) =>
    commit.affectedFiles.includes(fileData.file),
  );
}

export function createFileToProjectMap(
  projectFileMap: ProjectFileMap,
): Record<string, string> {
  const fileToProjectMap = {};
  for (const [projectName, projectFiles] of Object.entries(projectFileMap)) {
    for (const file of projectFiles) {
      fileToProjectMap[file.file] = projectName;
    }
  }
  return fileToProjectMap;
}

/**
 * Returns the projects that `projectName` depends on, directly or through
 * other non-releasable projects, which are not released themselves.
 *
 * Conventional commits versioning treats a change to such a dependency as a
 * change to the dependent project (it can trigger a version bump), so the
 * dependent project's changelog needs to include those commits too.
 * Traversal stops at releasable projects, because their changes are listed in
 * their own changelogs and surface as dependency bumps instead.
 */
export function getNonReleasableDependencies(
  projectName: string,
  projectGraph: ProjectGraph,
  releasableProjects: Set<string>,
): string[] {
  const result = new Set<string>();
  const queue = [projectName];
  const visited = new Set<string>(queue);
  while (queue.length) {
    const current = queue.shift();
    for (const dependency of projectGraph.dependencies[current] ?? []) {
      const target = dependency.target;
      if (visited.has(target)) {
        continue;
      }
      visited.add(target);
      // Skip external nodes (e.g. npm packages) and releasable projects
      if (!projectGraph.nodes[target] || releasableProjects.has(target)) {
        continue;
      }
      result.add(target);
      queue.push(target);
    }
  }
  return Array.from(result);
}

/**
 * Attributes changes that touched any of the given dependency projects to
 * `projectName` as well, so that they are rendered in its changelog.
 */
export function attributeDependencyChangesToProject(
  changes: ChangelogChange[],
  projectName: string,
  dependencies: string[],
): ChangelogChange[] {
  if (!dependencies.length) {
    return changes;
  }
  const dependencySet = new Set(dependencies);
  return changes.map((change) => {
    if (
      change.affectedProjects === "*" ||
      change.affectedProjects.includes(projectName) ||
      !change.affectedProjects.some((p) => dependencySet.has(p))
    ) {
      return change;
    }
    return {
      ...change,
      affectedProjects: [...change.affectedProjects, projectName],
    };
  });
}
