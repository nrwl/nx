import * as semver from 'semver';
import type { ProjectGraph } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import type { NxReleaseConfig } from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import {
  readRawVersionPlans,
  type GroupVersionPlan,
  type ProjectsVersionPlan,
} from '../config/version-plans';
import type { ReleaseGraph } from '../utils/release-graph';
import type { VersionData } from '../utils/shared';
import { deriveSpecifierFromConventionalCommits } from './derive-specifier-from-conventional-commits';
import { deriveSpecifierFromVersionPlan } from './deriver-specifier-from-version-plans';
import { ProjectLogger } from './project-logger';
import {
  NOOP_VERSION_ACTIONS,
  SemverBumpType,
  VersionActions,
} from './version-actions';

export type ReleaseBoundaryCheckMode = 'off' | 'warn' | 'error';

export type ReleaseBoundaryFinding =
  | {
      /**
       * The project was not matched by the release filters, but is being released
       * because it depends on a released project and `updateDependents` added it.
       */
      type: 'added-by-dependents';
      project: string;
      releaseGroup: string | null;
      newVersion: string;
      releasedDependencies: string[];
    }
  | {
      /**
       * The project depends on a released project, but is not itself being released.
       */
      type: 'dependent-not-released';
      project: string;
      releaseGroup: string | null;
      dependency: string;
      dependencyNewVersion: string;
      declaredVersion: string | null;
      dependencyCollection: string | null;
      /**
       * Whether the declared version admits the dependency's new version.
       * `null` when the two cannot be compared as semver.
       */
      declaredVersionAdmitsNewVersion: boolean | null;
    }
  | {
      /**
       * A released project depends on this project, which is not being released
       * but has pending changes, or whose pending changes could not be determined.
       */
      type: 'dependency-not-released';
      project: string;
      releaseGroup: string | null;
      dependent: string;
      declaredVersion: string | null;
      pendingChanges:
        | { status: 'detected'; bump: Exclude<SemverBumpType, 'none'> }
        | { status: 'unknown'; reason: string };
    };

export class ReleaseBoundaryCheckError extends Error {
  constructor(public readonly findings: ReleaseBoundaryFinding[]) {
    super(
      [
        `The release boundary check found ${findings.length} issue(s):`,
        ...findings.map((f) => `- ${formatReleaseBoundaryFinding(f)}`),
      ].join('\n')
    );
    this.name = 'ReleaseBoundaryCheckError';
  }
}

type PendingChanges =
  | { status: 'none' }
  | Extract<
      ReleaseBoundaryFinding,
      { type: 'dependency-not-released' }
    >['pendingChanges'];

export async function checkReleaseBoundary({
  tree,
  projectGraph,
  nxReleaseConfig,
  releaseGraph,
  versionData,
  preid,
  userGivenSpecifier,
}: {
  tree: Tree;
  projectGraph: ProjectGraph;
  nxReleaseConfig: NxReleaseConfig;
  releaseGraph: ReleaseGraph;
  versionData: VersionData;
  preid: string;
  userGivenSpecifier: string | undefined;
}): Promise<ReleaseBoundaryFinding[]> {
  const versionActionsOf = (project: string) =>
    releaseGraph.projectsToVersionActions.get(project);
  // Projects without real version actions (e.g. Docker-only) get a placeholder version, not a release.
  const isNoop = (project: string) =>
    versionActionsOf(project) instanceof NOOP_VERSION_ACTIONS;
  const releasedVersions = new Map<string, string>();
  for (const [project, { newVersion }] of Object.entries(versionData)) {
    if (newVersion !== null && !isNoop(project)) {
      releasedVersions.set(project, newVersion);
    }
  }
  const released = new Set(releasedVersions.keys());
  const originallyFiltered = releaseGraph.getOriginallyFilteredProjects();
  const groupNameOf = (project: string) =>
    releaseGraph.getReleaseGroupNameForProject(project);
  const findings: ReleaseBoundaryFinding[] = [];

  for (const [project, newVersion] of releasedVersions) {
    if (originallyFiltered.has(project)) {
      continue;
    }
    findings.push({
      type: 'added-by-dependents',
      project,
      releaseGroup: groupNameOf(project),
      newVersion,
      releasedDependencies: Array.from(
        releaseGraph.getProjectDependencies(project)
      ).filter((dep) => released.has(dep)),
    });
  }

  for (const [project, newVersion] of releasedVersions) {
    for (const dependent of releaseGraph.originalDependentProjectsPerProject.get(
      project
    ) ?? []) {
      if (released.has(dependent.source) || isNoop(dependent.source)) {
        continue;
      }
      findings.push({
        type: 'dependent-not-released',
        project: dependent.source,
        releaseGroup: groupNameOf(dependent.source),
        dependency: project,
        dependencyNewVersion: newVersion,
        declaredVersion: dependent.rawVersionSpec,
        dependencyCollection: dependent.dependencyCollection,
        declaredVersionAdmitsNewVersion: usesNpmVersionRanges(
          versionActionsOf(dependent.source)
        )
          ? admitsVersion(dependent.rawVersionSpec, newVersion)
          : null,
      });
    }
  }

  const context: PendingChangesContext = {
    tree,
    projectGraph,
    nxReleaseConfig,
    releaseGraph,
    preid,
    userGivenSpecifier,
    pendingChangesBySubject: new Map(),
  };
  // The processor derived these projects' own changes in this run, so an unreleased one has none pending.
  const evaluatedByProcessor = (project: string) =>
    releaseGraph.releaseGroups.some(
      (group) =>
        group.projects.includes(project) &&
        (group.projectsRelationship === 'fixed' ||
          releaseGraph.releaseGroupToFilteredProjects.get(group)?.has(project))
    );
  for (const project of released) {
    for (const dependency of releaseGraph.getProjectDependencies(project)) {
      if (
        released.has(dependency) ||
        isNoop(dependency) ||
        evaluatedByProcessor(dependency)
      ) {
        continue;
      }
      const pendingChanges = await resolvePendingChanges(dependency, context);
      if (pendingChanges.status === 'none') {
        continue;
      }
      const versionActions = versionActionsOf(project);
      const declaredVersion = versionActions
        ? await attempt(
            async () =>
              (
                await versionActions.readCurrentVersionOfDependency(
                  tree,
                  projectGraph,
                  dependency
                )
              ).currentVersion
          )
        : null;
      findings.push({
        type: 'dependency-not-released',
        project: dependency,
        releaseGroup: groupNameOf(dependency),
        dependent: project,
        declaredVersion,
        pendingChanges,
      });
    }
  }

  return findings;
}

export function formatReleaseBoundaryFinding(
  finding: ReleaseBoundaryFinding
): string {
  switch (finding.type) {
    case 'added-by-dependents': {
      const because = finding.releasedDependencies.length
        ? ` because it depends on ${finding.releasedDependencies
            .map((d) => `"${d}"`)
            .join(', ')}`
        : '';
      return `"${finding.project}" (release group "${finding.releaseGroup}") was not selected, but is being released as ${finding.newVersion}${because} and "updateDependents" added it.`;
    }
    case 'dependent-not-released': {
      const declared =
        finding.declaredVersion === null
          ? `does not declare a version of it`
          : `declares "${finding.declaredVersion}"${
              finding.dependencyCollection
                ? ` in ${finding.dependencyCollection}`
                : ''
            }`;
      const consequence =
        finding.declaredVersionAdmitsNewVersion === true
          ? `, which admits the new version without "${finding.project}" being released again`
          : finding.declaredVersionAdmitsNewVersion === false
            ? ', which excludes the new version'
            : '';
      return `"${finding.project}" (release group "${finding.releaseGroup}") is not being released, but depends on "${finding.dependency}", which is being released as ${finding.dependencyNewVersion}. It ${declared}${consequence}.`;
    }
    case 'dependency-not-released': {
      const declared =
        finding.declaredVersion === null
          ? ''
          : ` It declares "${finding.declaredVersion}".`;
      const pending =
        finding.pendingChanges.status === 'detected'
          ? `has pending changes (a "${finding.pendingChanges.bump}" bump)`
          : `may have pending changes (${finding.pendingChanges.reason})`;
      return `"${finding.dependent}" is being released and depends on "${finding.project}" (release group "${finding.releaseGroup}"), which is not being released but ${pending}.${declared}`;
    }
  }
}

function admitsVersion(
  declaredVersion: string | null,
  version: string
): boolean | null {
  if (
    !declaredVersion ||
    !semver.validRange(declaredVersion) ||
    !semver.valid(version)
  ) {
    return null;
  }
  return semver.satisfies(version, declaredVersion);
}

// Range semantics differ by ecosystem (Cargo reads a bare "1.0.0" as "^1.0.0"), so only judge npm-style manifests.
function usesNpmVersionRanges(versionActions: VersionActions | undefined) {
  const manifests = versionActions?.validManifestFilenames;
  return !!manifests?.length && manifests.every((m) => m === 'package.json');
}

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

interface PendingChangesContext {
  tree: Tree;
  projectGraph: ProjectGraph;
  nxReleaseConfig: NxReleaseConfig;
  releaseGraph: ReleaseGraph;
  preid: string;
  userGivenSpecifier: string | undefined;
  pendingChangesBySubject: Map<string, Promise<PendingChanges>>;
  rawVersionPlans?: Promise<unknown[]>;
}

function resolvePendingChanges(
  projectName: string,
  context: PendingChangesContext
): Promise<PendingChanges> {
  const releaseGroup = context.releaseGraph.allReleaseGroups.find((g) =>
    g.projects.includes(projectName)
  );
  if (!releaseGroup) {
    return Promise.resolve({ status: 'none' });
  }
  // A fixed group is versioned as a whole, from its first project.
  const subject =
    releaseGroup.projectsRelationship === 'fixed'
      ? releaseGroup.projects[0]
      : projectName;
  let pendingChanges = context.pendingChangesBySubject.get(subject);
  if (!pendingChanges) {
    pendingChanges = resolvePendingChangesForSubject(
      subject,
      releaseGroup,
      context
    ).catch((e) => ({
      status: 'unknown' as const,
      reason: e instanceof Error ? e.message.split('\n')[0] : String(e),
    }));
    context.pendingChangesBySubject.set(subject, pendingChanges);
  }
  return pendingChanges;
}

async function resolvePendingChangesForSubject(
  subject: string,
  releaseGroup: ReleaseGroupWithName,
  context: PendingChangesContext
): Promise<PendingChanges> {
  const {
    tree,
    projectGraph,
    nxReleaseConfig,
    releaseGraph,
    preid,
    userGivenSpecifier,
  } = context;
  const finalConfig = releaseGraph.finalConfigsByProject.get(subject);
  const versionActions = releaseGraph.projectsToVersionActions.get(subject);
  if (!finalConfig || !versionActions) {
    return { status: 'none' };
  }
  const versionOnDisk = async () =>
    (
      await attempt(() =>
        versionActions.readCurrentVersionFromSourceManifest(tree)
      )
    )?.currentVersion ?? null;

  if (finalConfig.specifierSource === 'conventional-commits') {
    const latestMatchingGitTag = await releaseGraph.resolveLatestMatchingGitTag(
      releaseGroup,
      subject,
      preid
    );
    if (
      !latestMatchingGitTag &&
      finalConfig.fallbackCurrentVersionResolver !== 'disk'
    ) {
      return {
        status: 'unknown',
        reason: `no git tag matches "${releaseGroup.releaseTag.pattern}"`,
      };
    }
    const currentVersion =
      latestMatchingGitTag?.extractedVersion ?? (await versionOnDisk());
    const bump = await deriveSpecifierFromConventionalCommits(
      nxReleaseConfig,
      projectGraph,
      // Collects the derivation logs without printing them for a project this run is not versioning.
      new ProjectLogger(subject),
      releaseGroup,
      projectGraph.nodes[subject],
      !!semver.prerelease(currentVersion ?? ''),
      latestMatchingGitTag ?? undefined,
      releaseGraph,
      finalConfig.fallbackCurrentVersionResolver,
      preid
    );
    return bump === 'none' ? { status: 'none' } : { status: 'detected', bump };
  }

  if (releaseGroup.versionPlans) {
    if (userGivenSpecifier) {
      context.rawVersionPlans ??= readRawVersionPlans();
      return (await context.rawVersionPlans).length === 0
        ? { status: 'none' }
        : {
            status: 'unknown',
            reason: 'version plans are not read when a specifier is given',
          };
    }
    const bumps = new Set(
      (
        (releaseGroup.resolvedVersionPlans || []) as (
          | ProjectsVersionPlan
          | GroupVersionPlan
        )[]
      )
        .map((plan) =>
          'groupVersionBump' in plan
            ? plan.groupVersionBump
            : plan.projectVersionBumps[subject]
        )
        .filter(Boolean)
    );
    if (bumps.size === 0) {
      return { status: 'none' };
    }
    if (bumps.size === 1) {
      return { status: 'detected', bump: [...bumps][0] };
    }
    // Which of several different bumps wins depends on the current version, resolved as the release would.
    const currentVersion =
      releaseGraph.cachedCurrentVersions.get(subject) ??
      (finalConfig.currentVersionResolver === 'git-tag'
        ? ((
            await releaseGraph.resolveLatestMatchingGitTag(
              releaseGroup,
              subject,
              preid
            )
          )?.extractedVersion ??
          (finalConfig.fallbackCurrentVersionResolver === 'disk'
            ? await versionOnDisk()
            : null))
        : finalConfig.currentVersionResolver === 'disk'
          ? await versionOnDisk()
          : null);
    if (!currentVersion) {
      return {
        status: 'unknown',
        reason:
          'its version plans have different bumps and its current version could not be resolved',
      };
    }
    const { bumpType } = await deriveSpecifierFromVersionPlan(
      new ProjectLogger(subject),
      releaseGroup,
      projectGraph.nodes[subject],
      currentVersion
    );
    return bumpType === 'none'
      ? { status: 'none' }
      : { status: 'detected', bump: bumpType };
  }

  return {
    status: 'unknown',
    reason: `its release group uses the "${finalConfig.specifierSource}" specifier source`,
  };
}
