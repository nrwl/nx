import { readFileSync, readdirSync } from 'fs';
import { pathExists, stat } from 'fs-extra';
import { join } from 'path';
import { RELEASE_TYPES, ReleaseType } from 'semver';
import { workspaceRoot } from '../../../utils/workspace-root';
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
}

export interface GroupVersionPlan extends VersionPlan {
  groupVersionBump: ReleaseType;
}

export interface ProjectsVersionPlan extends VersionPlan {
  projectVersionBumps: Record<string, ReleaseType>;
}

const versionPlansDirectory = join('.nx', 'version-plans');

export async function readRawVersionPlans(): Promise<RawVersionPlan[]> {
  const versionPlansPath = getVersionPlansAbsolutePath();
  const versionPlansPathExists = await pathExists(versionPlansPath);
  if (!versionPlansPathExists) {
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
      message: getSingleLineMessage(parsedContent.body),
      createdOnMs: versionPlanStats.birthtimeMs,
    });
  }

  return versionPlans;
}

export function setVersionPlansOnGroups(
  rawVersionPlans: RawVersionPlan[],
  releaseGroups: ReleaseGroupWithName[],
  allProjectNamesInWorkspace: string[]
): ReleaseGroupWithName[] {
  const groupsByName = releaseGroups.reduce(
    (acc, group) => acc.set(group.name, group),
    new Map<string, ReleaseGroupWithName>()
  );
  const isDefaultGroup = isDefault(releaseGroups);

  for (const rawVersionPlan of rawVersionPlans) {
    for (const [key, value] of Object.entries(rawVersionPlan.content)) {
      if (groupsByName.has(key)) {
        const group = groupsByName.get(key);

        if (!group.versionPlans) {
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
          group.versionPlans.find(
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
          group.versionPlans.push(<GroupVersionPlan>{
            absolutePath: rawVersionPlan.absolutePath,
            relativePath: rawVersionPlan.relativePath,
            fileName: rawVersionPlan.fileName,
            createdOnMs: rawVersionPlan.createdOnMs,
            message: rawVersionPlan.message,
            groupVersionBump: value,
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

        if (!groupForProject.versionPlans) {
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
            groupForProject.versionPlans.find(
              (plan) => plan.fileName === rawVersionPlan.fileName
            )
          );
          if (existingPlan) {
            existingPlan.projectVersionBumps[key] = value;
          } else {
            groupForProject.versionPlans.push(<ProjectsVersionPlan>{
              absolutePath: rawVersionPlan.absolutePath,
              relativePath: rawVersionPlan.relativePath,
              fileName: rawVersionPlan.fileName,
              createdOnMs: rawVersionPlan.createdOnMs,
              message: rawVersionPlan.message,
              projectVersionBumps: {
                [key]: value,
              },
            });
          }
        } else {
          const existingPlan = <GroupVersionPlan>(
            groupForProject.versionPlans.find(
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
            }
          } else {
            groupForProject.versionPlans.push(<GroupVersionPlan>{
              absolutePath: rawVersionPlan.absolutePath,
              relativePath: rawVersionPlan.relativePath,
              fileName: rawVersionPlan.fileName,
              createdOnMs: rawVersionPlan.createdOnMs,
              message: rawVersionPlan.message,
              // This is a fixed group, so the version bump is for the group, even if a project within it was specified
              groupVersionBump: value,
            });
          }
        }
      }
    }
  }

  // Order the plans from newest to oldest
  releaseGroups.forEach((group) => {
    if (group.versionPlans) {
      group.versionPlans.sort((a, b) => b.createdOnMs - a.createdOnMs);
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

// changelog messages may only be a single line long, so ignore anything else
function getSingleLineMessage(message: string) {
  return message.trim().split('\n')[0];
}
