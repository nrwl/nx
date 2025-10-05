import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

expect.addSnapshotSerializer({
  serialize(str: string) {
    return (
      str
        // Remove all output unique to specific projects to ensure deterministic snapshots
        .replaceAll(/my-pkg-\d+/g, '{project-name}')
        .replaceAll(
          /integrity:\s*.*/g,
          'integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        )
        .replaceAll(/version-plan-\d*.md/g, 'version-plan-XXX.md')
        .replaceAll(/\b[0-9a-f]{40}\b/g, '{SHASUM}')
        .replaceAll(/\d*B  index\.js/g, 'XXB  index.js')
        .replaceAll(/\d*B  project\.json/g, 'XXB  project.json')
        .replaceAll(/\d*B package\.json/g, 'XXXB package.json')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
        .replaceAll(/[a-fA-F0-9]{7}/g, '{COMMIT_SHA}')
        .replaceAll(/Test @[\w\d]+/g, 'Test @{COMMIT_AUTHOR}')
        // Normalize the version title date.
        .replaceAll(/\(\d{4}-\d{2}-\d{2}\)/g, '(YYYY-MM-DD)')
        // We trim each line to reduce the chances of snapshot flakiness
        .split('\n')
        .map((r) => r.trim())
        .join('\n')
    );
  },
  test(val: string) {
    return val != null && typeof val === 'string';
  },
});

describe('nx release releaseTagPattern', () => {
  let pkg1: string;

  beforeEach(async () => {
    newProject({
      packages: ['@nx/js'],
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${pkg1}`);

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);
  }, 60000);

  afterEach(() => cleanupProject());

  it('should prefer stable versions over prereleases', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        releaseTagPattern: 'v{version}',
        version: {
          conventionalCommits: true,
        },
      };
      return nxJson;
    });

    // Tag the existing commit as a prerelease
    await runCommandAsync(`git tag -a v1.0.0-beta.1 -m "v1.0.0-beta.1"`);

    // Resolve that prerelease as the current version
    expect(runCLI(`release version -d`)).toContain(
      `Resolved the current version as 1.0.0-beta.1 from git tag "v1.0.0-beta.1"`
    );

    // Make a new commit and tag it as a stable version
    await runCommandAsync(`echo "Hello" > README.md`);
    await runCommandAsync(`git add README.md`);
    await runCommandAsync(`git commit -m "chore: update README.md"`);
    await runCommandAsync(`git tag -a v1.0.0 -m "v1.0.0"`);

    expect(runCLI(`release version -d`)).toContain(
      `Resolved the current version as 1.0.0 from git tag "v1.0.0"`
    );
  });

  describe('releaseTagPatternCheckAllBranchesWhen', () => {
    it('should check the current branch first, and then fall back to all branches by default/when not specified', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });

      // No tags at all yet
      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `No git tags matching pattern "v{version}" for project "${pkg1}" were found`
      );

      // Create a matching tag on the current branch which should be found by default
      await runCommandAsync(`git tag -a v1.1.1 -m "v1.1.1"`);

      // Create a matching tag on a different branch, which it should NOT find (because there is already the match on the current branch)
      await runCommandAsync(`git checkout -b other-branch`);
      // Update the README.md to create a new commit to tag
      await runCommandAsync(`echo "Hello" > README.md`);
      await runCommandAsync(`git add README.md`);
      await runCommandAsync(`git commit -m "chore: update README.md"`);
      await runCommandAsync(`git tag -a v2.2.2 -m "v2.2.2"`);

      // Switch back to the original branch
      await runCommandAsync(`git checkout main`);

      // Finds the tag on the current branch
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 1.1.1 from git tag "v1.1.1"`
      );

      // Delete the tag on the current branch, now it should find the tag on the other branch
      await runCommandAsync(`git tag -d v1.1.1`);
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 2.2.2 from git tag "v2.2.2"`
      );
    });

    it('should check all branches immediately when releaseTagPatternCheckAllBranchesWhen is true', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          releaseTagPatternCheckAllBranchesWhen: true,
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });

      // No tags at all yet
      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `No git tags matching pattern "v{version}" for project "${pkg1}" were found`
      );

      // Create a matching tag on the current branch (this should not be found because we are going to create another tag on the other branch)
      await runCommandAsync(`git tag -a v1.1.1 -m "v1.1.1"`);

      // Create a matching tag on a different branch, which it should find (because releaseTagPatternCheckAllBranchesWhen is true)
      await runCommandAsync(`git checkout -b other-branch`);
      // Update the README.md to create a new commit to tag
      await runCommandAsync(`echo "Hello" > README.md`);
      await runCommandAsync(`git add README.md`);
      await runCommandAsync(`git commit -m "chore: update README.md"`);
      await runCommandAsync(`git tag -a v2.2.2 -m "v2.2.2"`);

      // Switch back to the original branch
      await runCommandAsync(`git checkout main`);

      // Finds the matching tag on the other branch because it is more recent and all branches are checked immediately
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 2.2.2 from git tag "v2.2.2"`
      );
    });

    it('should only check the current branch when releaseTagPatternCheckAllBranchesWhen is false, never all branches', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          releaseTagPatternCheckAllBranchesWhen: false,
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });

      // No tags at all yet
      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `No git tags matching pattern "v{version}" for project "${pkg1}" were found`
      );

      // Create a matching tag on the current branch which should be found
      await runCommandAsync(`git tag -a v1.1.1 -m "v1.1.1"`);

      // Create a matching tag on a different branch, which it should NOT ever find
      await runCommandAsync(`git checkout -b other-branch`);
      // Update the README.md to create a new commit to tag
      await runCommandAsync(`echo "Hello" > README.md`);
      await runCommandAsync(`git add README.md`);
      await runCommandAsync(`git commit -m "chore: update README.md"`);
      await runCommandAsync(`git tag -a v2.2.2 -m "v2.2.2"`);

      // Switch back to the original branch
      await runCommandAsync(`git checkout main`);

      // Finds the tag on the current branch
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 1.1.1 from git tag "v1.1.1"`
      );

      // Delete the tag on the current branch, now it should find any matching tag because the other branch will not be checked
      await runCommandAsync(`git tag -d v1.1.1`);
      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `No git tags matching pattern "v{version}" for project "${pkg1}" were found`
      );
    });

    it('should check all branches when the current branch matches one of the entries in the releaseTagPatternCheckAllBranchesWhen array', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          // This means => when we are on a branch called "main", we should check all branches, not just the current one
          releaseTagPatternCheckAllBranchesWhen: ['main'],
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });

      // No tags at all yet
      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `No git tags matching pattern "v{version}" for project "${pkg1}" were found`
      );

      // Create a matching tag on the current branch (this should not be found because we are going to create another tag on the other branch)
      await runCommandAsync(`git tag -a v1.1.1 -m "v1.1.1"`);

      // Create a matching tag on a different branch, which it should find (because releaseTagPatternCheckAllBranchesWhen is true)
      await runCommandAsync(`git checkout -b other-branch`);
      // Update the README.md to create a new commit to tag
      await runCommandAsync(`echo "Hello" > README.md`);
      await runCommandAsync(`git add README.md`);
      await runCommandAsync(`git commit -m "chore: update README.md"`);
      await runCommandAsync(`git tag -a v2.2.2 -m "v2.2.2"`);

      // Switch back to the original branch
      await runCommandAsync(`git checkout main`);

      // Finds the matching tag on the other branch because it is more recent and all branches are checked immediately
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 2.2.2 from git tag "v2.2.2"`
      );

      // Change the config to confirm its behavior changes accordingly
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          // This means => when we are on a branch called "does-not-exist", we should check all branches, not just the current one (this will intentionally not match the current branch)
          releaseTagPatternCheckAllBranchesWhen: ['does-not-exist'],
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });

      // Finds the matching tag on the current branch, because the current branch "main" does not match any entries in the releaseTagPatternCheckAllBranchesWhen array
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 1.1.1 from git tag "v1.1.1"`
      );

      // Change the config to confirm it supports glob patterns
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          // This means => when we are on a branch that matches the pattern "ma*", we should check all branches, not just the current one (this should match the current branch called "main")
          releaseTagPatternCheckAllBranchesWhen: ['ma*'],
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });

      // Finds the matching tag on the other branch because the current branch "main" matches the pattern "ma*", and we should therefore check all branches for a matching tag
      expect(runCLI(`release version -d`)).toContain(
        `Resolved the current version as 2.2.2 from git tag "v2.2.2"`
      );
    });
  });
});
