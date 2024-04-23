/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';

/**
 * This function groups targets based on the targetGroups metadata
 * If there is no targetGroups metadata, it will create a group for each target
 * @param project
 * @returns
 */
export function groupTargets(
  project: ProjectGraphProjectNode
): Record<string, string[]> {
  let targetGroups = project.data.metadata?.targetGroups ?? {};
  const allTargetsInTargetGroups: string[] = Object.values(targetGroups).flat();
  const allTargets: string[] = Object.keys(project.data.targets ?? {}).sort(
    sortNxReleasePublishLast
  );
  allTargets.forEach((target) => {
    if (!allTargetsInTargetGroups.includes(target)) {
      targetGroups[target] = [target];
    }
  });
  return targetGroups;
}

export function defaultSelectTargetGroup(project: ProjectGraphProjectNode) {
  return Object.keys(groupTargets(project))[0];
}

function sortNxReleasePublishLast(a: string, b: string) {
  if (a === 'nx-release-publish') return 1;
  if (b === 'nx-release-publish') return -1;
  return 1;
}

/**
 * This funciton returns the target group for a given target
 * If the target is not in a group, it will return the target name
 * @param targetName
 * @param project
 * @returns
 */
export function getTargetGroupForTarget(
  targetName: string,
  project: ProjectGraphProjectNode
): string {
  let targetGroups = project.data.metadata?.targetGroups ?? {};
  const foundTargetGroup = Object.keys(targetGroups).find((group) =>
    targetGroups[group].includes(targetName)
  );
  return foundTargetGroup ?? targetName;
}
