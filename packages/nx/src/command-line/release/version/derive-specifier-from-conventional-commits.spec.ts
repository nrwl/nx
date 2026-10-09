const mocks = {
  resolveSemverSpecifierFromConventionalCommits: vi.fn(),
  getLatestGitTagForPattern: vi.fn(),
  getFirstGitCommit: vi.fn(),
  getFirstProjectCommit: vi.fn(),
};

vi.mock('../utils/resolve-semver-specifier', () => ({
  resolveSemverSpecifierFromConventionalCommits: (...args: any[]) =>
    mocks.resolveSemverSpecifierFromConventionalCommits(...args),
}));

vi.mock('../utils/git', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getLatestGitTagForPattern: (...args: any[]) =>
      mocks.getLatestGitTagForPattern(...args),
    getFirstGitCommit: (...args: any[]) => mocks.getFirstGitCommit(...args),
    getFirstProjectCommit: (...args: any[]) =>
      mocks.getFirstProjectCommit(...args),
  };
});

import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { NxReleaseConfig } from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import type { ReleaseGraph } from '../utils/release-graph';
import { SemverSpecifier } from '../utils/semver';
import { deriveSpecifierFromConventionalCommits } from './derive-specifier-from-conventional-commits';
import { ProjectLogger } from './project-logger';

describe('deriveSpecifierFromConventionalCommits', () => {
  const projectName = 'my-lib';
  const projectGraphNode = {
    name: projectName,
    data: { root: 'libs/my-lib' },
  } as ProjectGraphProjectNode;
  const releaseGroup = {
    name: '__default__',
    projects: [projectName],
    projectsRelationship: 'fixed',
    releaseTag: {
      pattern: 'v{version}',
      checkAllBranchesWhen: undefined,
      requireSemver: true,
      strictPreid: true,
    },
  } as ReleaseGroupWithName;
  const projectLogger = new ProjectLogger(projectName);
  const releaseGraph = {
    resolveRepositoryTags: vi.fn(),
  } as unknown as ReleaseGraph;

  const derive = ({
    currentVersion,
    derivedSpecifier,
    latestMatchingGitTag = {
      tag: `v${currentVersion}`,
      extractedVersion: currentVersion,
    },
    latestStableGitTag = null,
    preid,
  }: {
    currentVersion: string;
    derivedSpecifier: SemverSpecifier | null;
    latestMatchingGitTag?: { tag: string; extractedVersion: string } | null;
    latestStableGitTag?: { tag: string; extractedVersion: string } | null;
    preid?: string;
  }) => {
    mocks.resolveSemverSpecifierFromConventionalCommits.mockResolvedValue(
      new Map([[projectName, derivedSpecifier]])
    );
    mocks.getLatestGitTagForPattern.mockResolvedValue(latestStableGitTag);
    return deriveSpecifierFromConventionalCommits(
      {} as NxReleaseConfig,
      {} as ProjectGraph,
      projectLogger,
      releaseGroup,
      projectGraphNode,
      currentVersion,
      latestMatchingGitTag,
      releaseGraph,
      undefined,
      preid
    );
  };

  it('should resolve the derived specifier for a stable current version', async () => {
    await expect(
      derive({
        currentVersion: '2.1.9',
        derivedSpecifier: SemverSpecifier.MAJOR,
      })
    ).resolves.toBe('major');
    await expect(
      derive({
        currentVersion: '2.1.9',
        derivedSpecifier: SemverSpecifier.MINOR,
      })
    ).resolves.toBe('minor');
    await expect(
      derive({
        currentVersion: '2.1.9',
        derivedSpecifier: SemverSpecifier.PATCH,
      })
    ).resolves.toBe('patch');
  });

  it('should combine the derived specifier with a preid for a stable current version', async () => {
    await expect(
      derive({
        currentVersion: '2.1.9',
        derivedSpecifier: SemverSpecifier.MAJOR,
        preid: 'rc',
      })
    ).resolves.toBe('premajor');
  });

  it('should return "none" when no changes are detected', async () => {
    await expect(
      derive({ currentVersion: '2.2.0-rc.0', derivedSpecifier: null })
    ).resolves.toBe('none');
  });

  it('should resolve "prerelease" when the derived severity does not exceed the bump the current prerelease encodes', async () => {
    const latestStableGitTag = { tag: 'v2.1.9', extractedVersion: '2.1.9' };
    // 2.2.0-rc.0 already encodes a minor bump over 2.1.9
    await expect(
      derive({
        currentVersion: '2.2.0-rc.0',
        derivedSpecifier: SemverSpecifier.PATCH,
        latestStableGitTag,
        preid: 'rc',
      })
    ).resolves.toBe('prerelease');
    await expect(
      derive({
        currentVersion: '2.2.0-rc.0',
        derivedSpecifier: SemverSpecifier.MINOR,
        latestStableGitTag,
        preid: 'rc',
      })
    ).resolves.toBe('prerelease');
  });

  it('should escalate to a higher prerelease base when the derived severity exceeds the encoded bump', async () => {
    const latestStableGitTag = { tag: 'v2.1.9', extractedVersion: '2.1.9' };
    // 2.2.0-rc.0 encodes minor; a breaking change must produce 3.0.0-rc.0
    await expect(
      derive({
        currentVersion: '2.2.0-rc.0',
        derivedSpecifier: SemverSpecifier.MAJOR,
        latestStableGitTag,
        preid: 'rc',
      })
    ).resolves.toBe('premajor');
    // 2.1.10-rc.0 encodes patch; a feature must produce 2.2.0-rc.0
    await expect(
      derive({
        currentVersion: '2.1.10-rc.0',
        derivedSpecifier: SemverSpecifier.MINOR,
        latestStableGitTag,
        preid: 'rc',
      })
    ).resolves.toBe('preminor');
  });

  it('should stay on "prerelease" when the derived severity matches the encoded bump', async () => {
    // 3.0.0-rc.0 already encodes a major bump over 2.1.9
    await expect(
      derive({
        currentVersion: '3.0.0-rc.0',
        derivedSpecifier: SemverSpecifier.MAJOR,
        latestStableGitTag: { tag: 'v2.1.9', extractedVersion: '2.1.9' },
        preid: 'rc',
      })
    ).resolves.toBe('prerelease');
  });

  it('should stay on "prerelease" when no stable tag can be resolved', async () => {
    await expect(
      derive({
        currentVersion: '1.0.0-beta.0',
        derivedSpecifier: SemverSpecifier.MAJOR,
        latestStableGitTag: null,
        preid: 'beta',
      })
    ).resolves.toBe('prerelease');
  });
});
