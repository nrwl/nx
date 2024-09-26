import { exec } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'path';
import { RELEASE_TYPES, ReleaseType } from 'semver';
import { workspaceRoot } from '../../../utils/workspace-root';
import { RawGitCommit } from '../utils/git';
import { IMPLICIT_DEFAULT_RELEASE_GROUP } from './config';
import { ReleaseGroupWithName } from './filter-release-groups';
const fm = require('front-matter');

export interface VersionPlanFile {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  createdOnMs: number;
}

export interface RawVersionPlan extends VersionPlanFile {
  content: Record<string, string>;
  message: string;
}

export interface VersionPlan extends VersionPlanFile {
  message: string;
  /**
   * The commit that added the version plan file, will be null if the file was never committed.
   * For optimal performance, we don't apply it at the time of reading the raw contents, because
   * it hasn't yet passed further validation at that point.
   */
  commit: RawGitCommit | null;
}

export interface GroupVersionPlan extends VersionPlan {
  groupVersionBump: ReleaseType;
  /**
   * The commit that added the version plan file, will be null if the file was never committed.
   * For optimal performance, we don't apply it at the time of reading the raw contents, because.
   * it hasn't yet passed validation.
   */
  commit: RawGitCommit | null;
  /**
   * Will not be set if the group name was the trigger, otherwise will be a list of
   * all the individual project names explicitly found in the version plan file.
   */
  triggeredByProjects?: string[];
}

export interface ProjectsVersionPlan extends VersionPlan {
  projectVersionBumps: Record<string, ReleaseType>;
}

const versionPlansDirectory = join('.nx', 'version-plans');

export async function readRawVersionPlans(): Promise<RawVersionPlan[]> {
  const versionPlansPath = getVersionPlansAbsolutePath();
  if (!existsSync(versionPlansPath)) {
    return [];
  }

  const versionPlans: RawVersionPlan[] = [];

  const versionPlanFiles = readdirSync(versionPlansPath);
  for (const versionPlanFile of versionPlanFiles) {
    const filePath = join(versionPlansPath, versionPlanFile);
    const versionPlanContent = readFileSync(filePath).toString();
    const versionPlanStats = await stat(filePath);

    const parsedContent = fm(versionPlanContent);
    versionPlans.push({
      absolutePath: filePath,
      relativePath: join(versionPlansDirectory, versionPlanFile),
      fileName: versionPlanFile,
      content: parsedContent.attributes,
      message: parsedContent.body,
      createdOnMs: versionPlanStats.birthtimeMs,
    });
  }

  return versionPlans;
}

export async function setResolvedVersionPlansOnGroups(
  rawVersionPlans: RawVersionPlan[],
  releaseGroups: ReleaseGroupWithName[],
  allProjectNamesInWorkspace: string[],
  isVerbose: boolean
): Promise<ReleaseGroupWithName[]> {
  const groupsByName = releaseGroups.reduce(
    (acc, group) => acc.set(group.name, group),
    new Map<string, ReleaseGroupWithName>()
  );
  const isDefaultGroup = isDefault(releaseGroups);

  for (const rawVersionPlan of rawVersionPlans) {
    if (!rawVersionPlan.message) {
      throw new Error(
        `Please add a changelog message to version plan: '${rawVersionPlan.fileName}'`
      );
    }

    for (const [key, value] of Object.entries(rawVersionPlan.content)) {
      if (groupsByName.has(key)) {
        const group = groupsByName.get(key);

        if (!group.resolvedVersionPlans) {
          if (isDefaultGroup) {
            throw new Error(
              `Found a version bump in '${rawVersionPlan.fileName}' but version plans are not enabled.`
            );
          } else {
            throw new Error(
              `Found a version bump for group '${key}' in '${rawVersionPlan.fileName}' but the group does not have version plans enabled.`
            );
          }
        }

        if (group.projectsRelationship === 'independent') {
          if (isDefaultGroup) {
            throw new Error(
              `Found a version bump in '${rawVersionPlan.fileName}' but projects are configured to be independently versioned. Individual projects should be bumped instead.`
            );
          } else {
            throw new Error(
              `Found a version bump for group '${key}' in '${rawVersionPlan.fileName}' but the group's projects are independently versioned. Individual projects of '${key}' should be bumped instead.`
            );
          }
        }

        if (!isReleaseType(value)) {
          if (isDefaultGroup) {
            throw new Error(
              `Found a version bump in '${
                rawVersionPlan.fileName
              }' with an invalid release type. Please specify one of ${RELEASE_TYPES.join(
                ', '
              )}.`
            );
          } else {
            throw new Error(
              `Found a version bump for group '${key}' in '${
                rawVersionPlan.fileName
              }' with an invalid release type. Please specify one of ${RELEASE_TYPES.join(
                ', '
              )}.`
            );
          }
        }

        const existingPlan = <GroupVersionPlan>(
          group.resolvedVersionPlans.find(
            (plan) => plan.fileName === rawVersionPlan.fileName
          )
        );
        if (existingPlan) {
          if (existingPlan.groupVersionBump !== value) {
            if (isDefaultGroup) {
              throw new Error(
                `Found a version bump in '${rawVersionPlan.fileName}' that conflicts with another version bump. When in fixed versioning mode, all version bumps must match.`
              );
            } else {
              throw new Error(
                `Found a version bump for group '${key}' in '${rawVersionPlan.fileName}' that conflicts with another version bump for this group. When the group is in fixed versioning mode, all groups' version bumps within the same version plan must match.`
              );
            }
          }
        } else {
          group.resolvedVersionPlans.push(<GroupVersionPlan>{
            absolutePath: rawVersionPlan.absolutePath,
            relativePath: rawVersionPlan.relativePath,
            fileName: rawVersionPlan.fileName,
            createdOnMs: rawVersionPlan.createdOnMs,
            message: rawVersionPlan.message,
            groupVersionBump: value,
            commit: await getCommitForVersionPlanFile(
              rawVersionPlan,
              isVerbose
            ),
          });
        }
      } else {
        const groupForProject = releaseGroups.find((group) =>
          group.projects.includes(key)
        );
        if (!groupForProject) {
          if (!allProjectNamesInWorkspace.includes(key)) {
            throw new Error(
              `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' but the project does not exist in the workspace.`
            );
          }

          if (isDefaultGroup) {
            throw new Error(
              `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' but the project is not configured for release. Ensure it is included by the 'release.projects' globs in nx.json.`
            );
          } else {
            throw new Error(
              `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' but the project is not in any configured release groups.`
            );
          }
        }

        if (!groupForProject.resolvedVersionPlans) {
          if (isDefaultGroup) {
            throw new Error(
              `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' but version plans are not enabled.`
            );
          } else {
            throw new Error(
              `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' but the project's group '${groupForProject.name}' does not have version plans enabled.`
            );
          }
        }

        if (!isReleaseType(value)) {
          throw new Error(
            `Found a version bump for project '${key}' in '${
              rawVersionPlan.fileName
            }' with an invalid release type. Please specify one of ${RELEASE_TYPES.join(
              ', '
            )}.`
          );
        }

        if (groupForProject.projectsRelationship === 'independent') {
          const existingPlan = <ProjectsVersionPlan>(
            groupForProject.resolvedVersionPlans.find(
              (plan) => plan.fileName === rawVersionPlan.fileName
            )
          );
          if (existingPlan) {
            existingPlan.projectVersionBumps[key] = value;
          } else {
            groupForProject.resolvedVersionPlans.push(<ProjectsVersionPlan>{
              absolutePath: rawVersionPlan.absolutePath,
              relativePath: rawVersionPlan.relativePath,
              fileName: rawVersionPlan.fileName,
              createdOnMs: rawVersionPlan.createdOnMs,
              message: rawVersionPlan.message,
              projectVersionBumps: {
                [key]: value,
              },
              commit: await getCommitForVersionPlanFile(
                rawVersionPlan,
                isVerbose
              ),
            });
          }
        } else {
          const existingPlan = <GroupVersionPlan>(
            groupForProject.resolvedVersionPlans.find(
              (plan) => plan.fileName === rawVersionPlan.fileName
            )
          );
          // This can occur if the same fixed release group has multiple entries for different projects within
          // the same version plan file. This will be the case when users are using the default release group.
          if (existingPlan) {
            if (existingPlan.groupVersionBump !== value) {
              if (isDefaultGroup) {
                throw new Error(
                  `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' that conflicts with another version bump. When in fixed versioning mode, all version bumps must match.`
                );
              } else {
                throw new Error(
                  `Found a version bump for project '${key}' in '${rawVersionPlan.fileName}' that conflicts with another project's version bump in the same release group '${groupForProject.name}'. When the group is in fixed versioning mode, all projects' version bumps within the same group must match.`
                );
              }
            } else {
              existingPlan.triggeredByProjects.push(key);
            }
          } else {
            groupForProject.resolvedVersionPlans.push(<GroupVersionPlan>{
              absolutePath: rawVersionPlan.absolutePath,
              relativePath: rawVersionPlan.relativePath,
              fileName: rawVersionPlan.fileName,
              createdOnMs: rawVersionPlan.createdOnMs,
              message: rawVersionPlan.message,
              // This is a fixed group, so the version bump is for the group, even if a project within it was specified
              // but we track the projects that triggered the version bump so that we can accurately produce changelog entries.
              groupVersionBump: value,
              triggeredByProjects: [key],
              commit: await getCommitForVersionPlanFile(
                rawVersionPlan,
                isVerbose
              ),
            });
          }
        }
      }
    }
  }

  // Order the plans from newest to oldest
  releaseGroups.forEach((group) => {
    if (group.resolvedVersionPlans) {
      group.resolvedVersionPlans.sort((a, b) => b.createdOnMs - a.createdOnMs);
    }
  });

  return releaseGroups;
}

function isDefault(releaseGroups: ReleaseGroupWithName[]) {
  return (
    releaseGroups.length === 1 &&
    releaseGroups.some((group) => group.name === IMPLICIT_DEFAULT_RELEASE_GROUP)
  );
}

export function getVersionPlansAbsolutePath() {
  return join(workspaceRoot, versionPlansDirectory);
}

function isReleaseType(value: string): value is ReleaseType {
  return RELEASE_TYPES.includes(value as ReleaseType);
}

async function getCommitForVersionPlanFile(
  rawVersionPlan: RawVersionPlan,
  isVerbose: boolean
): Promise<RawGitCommit | null> {
  return new Promise((resolve) => {
    exec(
      `git log --diff-filter=A --pretty=format:"%s|%h|%an|%ae|%b" -n 1 -- ${rawVersionPlan.absolutePath}`,
      {
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          if (isVerbose) {
            console.error(
              `Error executing git command for ${rawVersionPlan.relativePath}: ${error.message}`
            );
          }
          return resolve(null);
        }
        if (stderr) {
          if (isVerbose) {
            console.error(
              `Git command stderr for ${rawVersionPlan.relativePath}: ${stderr}`
            );
          }
          return resolve(null);
        }

        const [message, shortHash, authorName, authorEmail, ...body] = stdout
          .trim()
          .split('|');
        const commitDetails: RawGitCommit = {
          message: message || '',
          shortHash: shortHash || '',
          author: { name: authorName || '', email: authorEmail || '' },
          body: body.join('|') || '', // Handle case where body might be empty or contain multiple '|'
        };
        return resolve(commitDetails);
      }
    );
  });
}
