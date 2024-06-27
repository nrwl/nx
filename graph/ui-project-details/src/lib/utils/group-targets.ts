/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';

/**
 * This function groups targets based on the targetGroups metadata
 * If there is no targetGroups metadata, it will create a group for each target
 * @param project
 * @returns
 */
export function groupTargets(project: ProjectGraphProjectNode): {
  groups: Record<string, string[]>;
  targets: string[];
} {
  const targetGroups = project.data.metadata?.targetGroups ?? {};
  Object.entries(targetGroups).forEach(([group, targets]) => {
    targetGroups[group] = targets.sort(sortNxReleasePublishLast);
  });
  const allTargetsInTargetGroups: string[] = Object.values(targetGroups).flat();
  const targets: string[] = Object.keys(project.data.targets ?? {})
    .filter((target) => {
      return !allTargetsInTargetGroups.includes(target);
    })
    .sort(sortNxReleasePublishLast);
  return {
    groups: targetGroups ?? {},
    targets: targets ?? [],
  };
}

function sortNxReleasePublishLast(a: string, b: string) {
  if (a === 'nx-release-publish') return 1;
  if (b === 'nx-release-publish') return -1;
  return a.localeCompare(b);
}

export function getNonAtomizedTargetForGroup(
  project: ProjectGraphProjectNode,
  targetGroupName: string
): string | undefined {
  const targetWithNonAtomizedEquivalent = project.data.metadata?.targetGroups?.[
    targetGroupName
  ]?.find(
    (target) => project.data.targets?.[target]?.metadata?.nonAtomizedTarget
  );
  return targetWithNonAtomizedEquivalent
    ? project.data.targets?.[targetWithNonAtomizedEquivalent]?.metadata
        ?.nonAtomizedTarget
    : undefined;
}
