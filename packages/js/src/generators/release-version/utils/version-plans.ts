import { workspaceRoot } from '@nx/devkit';
import { readFileSync, readdirSync } from 'fs';
import { pathExists } from 'fs-extra';
import { join } from 'path';
import { RELEASE_TYPES, ReleaseType } from 'semver';
const fm = require('front-matter');

export interface VersionPlan {
  filePath: string;
  relativePath: string;
  message: string;
}

export interface GroupVersionPlan extends VersionPlan {
  groupVersionBump: ReleaseType;
}

export interface ProjectsVersionPlan extends VersionPlan {
  projectVersionBumps: Record<string, ReleaseType>;
}

const versionPlansDirectory = join('.nx', 'version-plans');

export async function getVersionPlansForFixedGroup(
  groupName: string
): Promise<GroupVersionPlan[]> {
  const versionPlans: GroupVersionPlan[] = [];

  const versionPlansPath = getVersionPlansAbsolutePath();
  const versionPlansPathExists = await pathExists(versionPlansPath);
  if (!versionPlansPathExists) {
    return [];
  }
  const versionPlanFiles = readdirSync(versionPlansPath);

  for (const versionPlanFile of versionPlanFiles) {
    const filePath = join(versionPlansPath, versionPlanFile);
    const versionPlanContent = readFileSync(filePath).toString();

    const parsedContent = fm(versionPlanContent);
    const groupVersionBump = parsedContent.attributes[groupName];

    // If the group version bump is a release type and the file starts with the group name,
    // then it is a valid version plan for a group with a fixed projectsRelationship
    if (
      isReleaseType(groupVersionBump) &&
      parsedContent.frontmatter.startsWith(groupName)
    ) {
      versionPlans.push({
        filePath,
        relativePath: join(versionPlansDirectory, versionPlanFile),
        groupVersionBump,
        message: parsedContent.body.trim(),
      });
    }
  }

  return versionPlans;
}

export async function getVersionPlansForIndependentGroup(
  groupName: string,
  projectNames: string[]
): Promise<ProjectsVersionPlan[]> {
  const versionPlans: ProjectsVersionPlan[] = [];

  const versionPlansPath = getVersionPlansAbsolutePath();
  const versionPlansPathExists = await pathExists(versionPlansPath);
  if (!versionPlansPathExists) {
    return [];
  }

  const versionPlanFiles = readdirSync(versionPlansPath);

  for (const versionPlanFile of versionPlanFiles) {
    const filePath = join(versionPlansPath, versionPlanFile);
    const versionPlanContent = readFileSync(filePath).toString();

    const parsedContent = fm(versionPlanContent);
    const groupValue = parsedContent.attributes[groupName];

    if (
      groupValue === 'independent' &&
      parsedContent.frontmatter.startsWith(groupName)
    ) {
      const projectVersionBumps = projectNames.reduce((acc, projectName) => {
        if (parsedContent.attributes[projectName]) {
          acc[projectName] = parsedContent.attributes[projectName];
        }
        return acc;
      }, {});

      if (Object.keys(projectVersionBumps).length) {
        versionPlans.push({
          filePath,
          relativePath: join(versionPlansDirectory, versionPlanFile),
          projectVersionBumps,
          message: parsedContent.body.trim(),
        });
      }
    }
  }

  return versionPlans;
}

function getVersionPlansAbsolutePath() {
  return join(workspaceRoot, versionPlansDirectory);
}

function isReleaseType(value: string): value is ReleaseType {
  return RELEASE_TYPES.includes(value as ReleaseType);
}
