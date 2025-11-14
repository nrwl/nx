import { ReleaseType } from 'semver';
import {
  GroupVersionPlan,
  ProjectsVersionPlan,
} from '../config/version-plans.js';
import {
  RawGitCommit,
  parseVersionPlanCommit,
  Reference,
} from '../utils/git.js';

export interface ChangelogChange {
  type: string;
  scope: string;
  description: string;
  affectedProjects: string[] | '*';
  body?: string;
  isBreaking?: boolean;
  githubReferences?: Reference[];
  authors?: { name: string; email: string }[];
  shortHash?: string;
  revertedHashes?: string[];
}

export function createChangesFromGroupVersionPlans(
  versionPlans: GroupVersionPlan[]
): ChangelogChange[] {
  return versionPlans
    .flatMap((vp) => {
      const releaseType = versionPlanSemverReleaseTypeToChangelogType(
        vp.groupVersionBump
      );
      const { githubReferences, authors } = extractVersionPlanMetadata(
        vp.commit
      );

      const changes: ChangelogChange[] = !vp.triggeredByProjects
        ? [
            {
              type: releaseType.type,
              scope: '',
              description: vp.message,
              body: '',
              isBreaking: releaseType.isBreaking,
              githubReferences,
              authors,
              affectedProjects: '*',
            },
          ]
        : vp.triggeredByProjects.map((project) => {
            return {
              type: releaseType.type,
              scope: project,
              description: vp.message,
              body: '',
              isBreaking: releaseType.isBreaking,
              githubReferences,
              authors,
              affectedProjects: [project],
            };
          });
      return changes;
    })
    .filter(Boolean);
}

export function createChangesFromProjectsVersionPlans(
  versionPlans: ProjectsVersionPlan[],
  projectName: string
): ChangelogChange[] {
  return versionPlans
    .map((vp) => {
      const bumpForProject = vp.projectVersionBumps[projectName];
      if (!bumpForProject) {
        return null;
      }
      const releaseType =
        versionPlanSemverReleaseTypeToChangelogType(bumpForProject);
      const { githubReferences, authors } = extractVersionPlanMetadata(
        vp.commit
      );

      return {
        type: releaseType.type,
        scope: projectName,
        description: vp.message,
        body: '',
        isBreaking: releaseType.isBreaking,
        affectedProjects: Object.keys(vp.projectVersionBumps),
        githubReferences,
        authors,
      } as ChangelogChange;
    })
    .filter(Boolean);
}

export function extractVersionPlanMetadata(commit: RawGitCommit | null): {
  githubReferences: Reference[];
  authors: { name: string; email: string }[] | undefined;
} {
  if (!commit) {
    return { githubReferences: [], authors: undefined };
  }

  const parsedCommit = parseVersionPlanCommit(commit);
  if (!parsedCommit) {
    return { githubReferences: [], authors: undefined };
  }

  return {
    githubReferences: parsedCommit.references,
    authors: parsedCommit.authors,
  };
}

export function versionPlanSemverReleaseTypeToChangelogType(
  bump: ReleaseType
): {
  type: 'fix' | 'feat';
  isBreaking: boolean;
} {
  switch (bump) {
    case 'premajor':
    case 'major':
      return { type: 'feat', isBreaking: true };
    case 'preminor':
    case 'minor':
      return { type: 'feat', isBreaking: false };
    case 'prerelease':
    case 'prepatch':
    case 'patch':
      return { type: 'fix', isBreaking: false };
    default:
      throw new Error(`Invalid semver bump type: ${bump}`);
  }
}
