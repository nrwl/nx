import * as chalk from 'chalk';
import { prerelease } from 'semver';
import { ProjectGraph } from '../../../config/project-graph';
import { Tree } from '../../../generators/tree';
import { createFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';
import { interpolate } from '../../../tasks-runner/utils';
import { output } from '../../../utils/output';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { GitCommit, gitAdd, gitCommit } from './git';

export const noDiffInChangelogMessage = chalk.yellow(
  `NOTE: There was no diff detected for the changelog entry. Maybe you intended to pass alternative git references via --from and --to?`
);

export type ReleaseVersionGeneratorResult = {
  data: VersionData;
  callback: (
    tree: Tree,
    opts: {
      dryRun?: boolean;
      verbose?: boolean;
      generatorOptions?: Record<string, unknown>;
    }
  ) => Promise<
    | string[]
    | {
        changedFiles: string[];
        deletedFiles: string[];
      }
  >;
};

export type VersionData = Record<
  string,
  {
    /**
     * newVersion will be null in the case that no changes are detected for the project,
     * e.g. when using conventional commits
     */
    newVersion: string | null;
    currentVersion: string;
    /**
     * The list of projects which depend upon the current project.
     * TODO: investigate generic type for this once more ecosystems are explored
     */
    dependentProjects: any[];
  }
>;

function isPrerelease(version: string): boolean {
  // prerelease returns an array of matching prerelease "components", or null if the version is not a prerelease
  return prerelease(version) !== null;
}

export class ReleaseVersion {
  rawVersion: string;
  gitTag: string;
  isPrerelease: boolean;

  constructor({
    version, // short form version string with no prefixes or patterns, e.g. 1.0.0
    releaseTagPattern, // full pattern to interpolate, e.g. "v{version}" or "{projectName}@{version}"
    projectName, // optional project name to interpolate into the releaseTagPattern
  }: {
    version: string;
    releaseTagPattern: string;
    projectName?: string;
  }) {
    this.rawVersion = version;
    this.gitTag = interpolate(releaseTagPattern, {
      version,
      projectName,
    });
    this.isPrerelease = isPrerelease(version);
  }
}

export async function commitChanges({
  changedFiles,
  deletedFiles,
  isDryRun,
  isVerbose,
  gitCommitMessages,
  gitCommitArgs,
}: {
  changedFiles?: string[];
  deletedFiles?: string[];
  isDryRun?: boolean;
  isVerbose?: boolean;
  gitCommitMessages?: string[];
  gitCommitArgs?: string;
}) {
  if (!changedFiles?.length && !deletedFiles?.length) {
    throw new Error('Error: No changed files to commit');
  }

  output.logSingleLine(`Committing changes with git`);
  await gitAdd({
    changedFiles,
    deletedFiles,
    dryRun: isDryRun,
    verbose: isVerbose,
  });
  // The extra logs need something breathing room
  if (isVerbose) {
    console.log('');
  }
  await gitCommit({
    messages: gitCommitMessages,
    additionalArgs: gitCommitArgs,
    dryRun: isDryRun,
    verbose: isVerbose,
  });
}

export function createCommitMessageValues(
  releaseGroups: ReleaseGroupWithName[],
  releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>,
  versionData: VersionData,
  commitMessage: string
): string[] {
  const commitMessageValues = [commitMessage];

  if (releaseGroups.length === 0) {
    return commitMessageValues;
  }

  // If we have exactly one release group, with a fixed relationship, then interpolate {version} as the new version for the release group
  if (
    releaseGroups.length === 1 &&
    releaseGroups[0].projectsRelationship === 'fixed'
  ) {
    const releaseGroup = releaseGroups[0];
    const releaseGroupProjectNames = Array.from(
      releaseGroupToFilteredProjects.get(releaseGroup)
    );
    const projectVersionData = versionData[releaseGroupProjectNames[0]]; // all at the same version, so we can just pick the first one
    const releaseVersion = new ReleaseVersion({
      version: projectVersionData.newVersion,
      releaseTagPattern: releaseGroup.releaseTagPattern,
    });
    commitMessageValues[0] = interpolate(commitMessageValues[0], {
      version: releaseVersion.rawVersion,
    }).trim();
    return commitMessageValues;
  }

  /**
   * There is another special case for interpolation: if, after all filtering, we have a single independent release group with a single project,
   * and the user has provided {projectName} within the custom message.
   * In this case we will directly interpolate both {version} and {projectName} within the commit message.
   */
  if (
    releaseGroups.length === 1 &&
    releaseGroups[0].projectsRelationship === 'independent' &&
    commitMessage.includes('{projectName}')
  ) {
    const releaseGroup = releaseGroups[0];
    const releaseGroupProjectNames = Array.from(
      releaseGroupToFilteredProjects.get(releaseGroup)
    );
    if (releaseGroupProjectNames.length === 1) {
      const projectVersionData = versionData[releaseGroupProjectNames[0]];
      const releaseVersion = new ReleaseVersion({
        version: projectVersionData.newVersion,
        releaseTagPattern: releaseGroup.releaseTagPattern,
        projectName: releaseGroupProjectNames[0],
      });
      commitMessageValues[0] = interpolate(commitMessageValues[0], {
        version: releaseVersion.rawVersion,
        projectName: releaseGroupProjectNames[0],
      }).trim();
      return commitMessageValues;
    }
  }

  /**
   * At this point we have multiple release groups for a single commit, we will not interpolate an overall {version} or {projectName} because that won't be
   * appropriate (for any {version} or {projectName} value within the string, we will replace it with an empty string so that it doesn't end up in the final output).
   *
   * Instead for fixed groups we will add one bullet point the release group, and for independent groups we will add one bullet point per project.
   */
  commitMessageValues[0] = stripPlaceholders(commitMessageValues[0], [
    // for cleanest possible final result try and replace the common pattern of a v prefix in front of the version first
    'v{version}',
    '{version}',
    '{projectName}',
  ]);

  for (const releaseGroup of releaseGroups) {
    const releaseGroupProjectNames = Array.from(
      releaseGroupToFilteredProjects.get(releaseGroup)
    );

    // One entry per project for independent groups
    if (releaseGroup.projectsRelationship === 'independent') {
      for (const project of releaseGroupProjectNames) {
        const projectVersionData = versionData[project];
        if (projectVersionData.newVersion !== null) {
          const releaseVersion = new ReleaseVersion({
            version: projectVersionData.newVersion,
            releaseTagPattern: releaseGroup.releaseTagPattern,
            projectName: project,
          });
          commitMessageValues.push(
            `- project: ${project} ${releaseVersion.rawVersion}`
          );
        }
      }
      continue;
    }

    // One entry for the whole group for fixed groups
    const projectVersionData = versionData[releaseGroupProjectNames[0]]; // all at the same version, so we can just pick the first one
    const releaseVersion = new ReleaseVersion({
      version: projectVersionData.newVersion,
      releaseTagPattern: releaseGroup.releaseTagPattern,
    });

    commitMessageValues.push(
      `- release-group: ${releaseGroup.name} ${releaseVersion.rawVersion}`
    );
  }

  return commitMessageValues;
}

function stripPlaceholders(str: string, placeholders: string[]): string {
  for (const placeholder of placeholders) {
    // for cleanest possible final result try and replace relevant spacing around placeholders first
    str = str
      .replace(` ${placeholder}`, '')
      .replace(`${placeholder} `, '')
      .replace(placeholder, '')
      .trim();
  }
  return str;
}

export function createGitTagValues(
  releaseGroups: ReleaseGroupWithName[],
  releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>,
  versionData: VersionData
): string[] {
  const tags = [];

  for (const releaseGroup of releaseGroups) {
    const releaseGroupProjectNames = Array.from(
      releaseGroupToFilteredProjects.get(releaseGroup)
    );
    // For independent groups we want one tag per project, not one for the overall group
    if (releaseGroup.projectsRelationship === 'independent') {
      for (const project of releaseGroupProjectNames) {
        const projectVersionData = versionData[project];
        if (projectVersionData.newVersion !== null) {
          tags.push(
            interpolate(releaseGroup.releaseTagPattern, {
              version: projectVersionData.newVersion,
              projectName: project,
            })
          );
        }
      }
      continue;
    }
    // For fixed groups we want one tag for the overall group
    const projectVersionData = versionData[releaseGroupProjectNames[0]]; // all at the same version, so we can just pick the first one
    if (projectVersionData.newVersion !== null) {
      tags.push(
        interpolate(releaseGroup.releaseTagPattern, {
          version: projectVersionData.newVersion,
        })
      );
    }
  }

  return tags;
}

function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }
  return Array.from(duplicates);
}

export function handleDuplicateGitTags(gitTagValues: string[]): void {
  // If any of the gitTagValues are identical we should hard error upfront to avoid an awkward git error later
  const duplicateGitTagValues = findDuplicates(gitTagValues);
  if (duplicateGitTagValues.length) {
    output.error({
      title: `Your current configuration would generate the following duplicate git tags:`,
      bodyLines: [
        ...duplicateGitTagValues.map((v) => `- ${v}`),
        '',
        `Please ensure that for "independent" release groups the {projectName} placeholder is used so that all dynamically created project tags are unique.`,
      ],
    });
    process.exit(1);
  }
}

export async function getCommitsRelevantToProjects(
  projectGraph: ProjectGraph,
  commits: GitCommit[],
  projects: string[]
): Promise<GitCommit[]> {
  const { fileMap } = await createFileMapUsingProjectGraph(projectGraph);
  const filesInReleaseGroup = new Set<string>(
    projects.reduce(
      (files, p) => [...files, ...fileMap.projectFileMap[p].map((f) => f.file)],
      [] as string[]
    )
  );

  /**
   * The relevant commits are those that either:
   * - touch project files which are contained within the list of projects directly
   * - touch non-project files and the commit is not scoped
   */
  return commits.filter((c) =>
    c.affectedFiles.some(
      (f) =>
        filesInReleaseGroup.has(f) ||
        (!c.scope &&
          fileMap.nonProjectFiles.some(
            (nonProjectFile) => nonProjectFile.file === f
          ))
    )
  );
}
