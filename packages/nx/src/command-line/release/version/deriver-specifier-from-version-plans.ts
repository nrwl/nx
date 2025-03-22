import { gt, inc, ReleaseType } from 'semver';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { GroupVersionPlan, ProjectsVersionPlan } from '../config/version-plans';
import { SemverBumpType } from './version-actions';
import { ProjectLogger } from './project-logger';

export async function deriveSpecifierFromVersionPlan(
  projectLogger: ProjectLogger,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode,
  currentVersion: string
): Promise<{
  bumpType: SemverBumpType;
  versionPlanPath: string;
}> {
  const projectName = projectGraphNode.name;

  let bumpType: ReleaseType | null = null;
  let versionPlanPath: string | null = null;

  if (releaseGroup.projectsRelationship === 'independent') {
    const result = (
      releaseGroup.resolvedVersionPlans as ProjectsVersionPlan[]
    ).reduce(
      (
        acc: { spec: ReleaseType | null; path: string | null },
        plan: ProjectsVersionPlan
      ) => {
        if (!acc.spec) {
          return {
            spec: plan.projectVersionBumps[projectName],
            path: plan.relativePath,
          };
        }
        if (plan.projectVersionBumps[projectName]) {
          const prevNewVersion = inc(currentVersion, acc.spec);
          const nextNewVersion = inc(
            currentVersion,
            plan.projectVersionBumps[projectName]
          );
          return gt(nextNewVersion, prevNewVersion)
            ? {
                spec: plan.projectVersionBumps[projectName],
                path: plan.relativePath,
              }
            : acc;
        }
        return acc;
      },
      { spec: null, path: null }
    );
    bumpType = result.spec;
    versionPlanPath = result.path;
  } else {
    const result = (
      releaseGroup.resolvedVersionPlans as GroupVersionPlan[]
    ).reduce(
      (
        acc: { spec: ReleaseType | null; path: string | null },
        plan: GroupVersionPlan
      ) => {
        if (!acc.spec) {
          return {
            spec: plan.groupVersionBump,
            path: plan.relativePath,
          };
        }

        const prevNewVersion = inc(currentVersion, acc.spec);
        const nextNewVersion = inc(currentVersion, plan.groupVersionBump);
        return gt(nextNewVersion, prevNewVersion)
          ? {
              spec: plan.groupVersionBump,
              path: plan.relativePath,
            }
          : acc;
      },
      { spec: null, path: null }
    );
    bumpType = result.spec;
    versionPlanPath = result.path;
  }

  if (!bumpType) {
    projectLogger.buffer(`🚫 No changes were detected within version plans`);
  }

  return {
    bumpType: bumpType ?? 'none',
    versionPlanPath,
  };
}
