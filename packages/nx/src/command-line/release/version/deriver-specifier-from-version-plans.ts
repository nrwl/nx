import { compare, inc, ReleaseType } from 'semver';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ReleaseGroupWithName } from '../config/filter-release-groups';
import { GroupVersionPlan, ProjectsVersionPlan } from '../config/version-plans';
import { SemverBumpType } from './version-actions';
import { ProjectLogger } from './project-logger';

export async function deriveSpecifierFromVersionPlan(
  projectLogger: ProjectLogger,
  releaseGroup: ReleaseGroupWithName,
  projectGraphNode: ProjectGraphProjectNode,
  currentVersion: string | null
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
          if (!currentVersion) {
            return acc;
          }
          const prevNewVersion = resolveDerivedVersion(
            inc(currentVersion, acc.spec),
            currentVersion,
            acc.spec
          );
          const nextNewVersion = resolveDerivedVersion(
            inc(currentVersion, plan.projectVersionBumps[projectName]),
            currentVersion,
            plan.projectVersionBumps[projectName]
          );
          return compare(nextNewVersion, prevNewVersion) > 0
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

        if (!currentVersion) {
          return acc;
        }
        const prevNewVersion = resolveDerivedVersion(
          inc(currentVersion, acc.spec),
          currentVersion,
          acc.spec
        );
        const nextNewVersion = resolveDerivedVersion(
          inc(currentVersion, plan.groupVersionBump),
          currentVersion,
          plan.groupVersionBump
        );
        return compare(nextNewVersion, prevNewVersion) > 0
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

function resolveDerivedVersion(
  value: string | { version: string } | null | undefined,
  currentVersion: string | null,
  bumpType: ReleaseType
): string {
  if (!value) {
    throw new Error(
      `Unable to derive a version from current version "${currentVersion}" and version plan bump "${bumpType}".`
    );
  }

  return typeof value === 'string' ? value : value.version;
}
