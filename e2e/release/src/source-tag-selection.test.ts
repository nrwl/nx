import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  uniq,
  updateJson,
} from '@nx/e2e/utils';

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

describe('nx release source tag selection', () => {
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

  describe('when no preid is specified', () => {
    beforeEach(() => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });
    });

    it('does not use pre-release tags as source', async () => {
      await runCommandAsync(`git tag -a v1.0.0-beta.1 -m "v1.0.0-beta.1"`);

      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `No git tags matching pattern "v{version}" for project "${pkg1}" were found`
      );
    });

    it('uses the latest stable tag as source', async () => {
      await runCommandAsync(`git tag -a v1.0.0 -m "v1.0.0"`);
      await runCommandAsync(`git tag -a v2.0.0-beta.1 -m "v2.0.0-beta.1"`);
      await runCommandAsync(`git tag -a v2.0.0 -m "v2.0.0"`);
      await runCommandAsync(`git tag -a v3.0.0-beta.1 -m "v3.0.0-beta.1"`);

      expect(
        runCLI(`release version -d`, {
          silenceError: true,
        })
      ).toContain(
        `Resolved the current version as 2.0.0 from git tag "v2.0.0"`
      );
    });
  });

  describe('when a preid is specified', () => {
    beforeEach(() => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          releaseTagPattern: 'v{version}',
          version: {
            conventionalCommits: true,
          },
        };
        return nxJson;
      });
    });

    it('uses the latest pre-release tag as source', async () => {
      await runCommandAsync(`git tag -a v1.0.0-alpha.1 -m "v1.0.0-alpha.1"`);
      await runCommandAsync(`git tag -a v1.0.1-alpha.1 -m "v1.0.1-alpha.1"`);

      expect(
        runCLI(`release version --preid=alpha -d`, {
          silenceError: true,
        })
      ).toContain(
        `Resolved the current version as 1.0.1-alpha.1 from git tag "v1.0.1-alpha.1"`
      );
    });

    it('does not use a tag with a different preid', async () => {
      await runCommandAsync(`git tag -a v1.0.0-alpha.1 -m "v1.0.0-alpha.1"`);
      await runCommandAsync(`git tag -a v1.0.0-beta.1 -m "v1.0.0-beta.1"`);

      expect(
        runCLI(`release version --preid=alpha -d`, {
          silenceError: true,
        })
      ).toContain(
        `Resolved the current version as 1.0.0-alpha.1 from git tag "v1.0.0-alpha.1"`
      );
    });

    it('uses the latest stable tag as source when no tags are found for the preid', async () => {
      await runCommandAsync(`git tag -a v1.0.0 -m "v1.0.0"`);
      await runCommandAsync(`git tag -a v1.0.1-alpha.1 -m "v1.0.1-alpha.1"`);

      expect(
        runCLI(`release version --preid=beta -d`, {
          silenceError: true,
        })
      ).toContain(
        `Resolved the current version as 1.0.0 from git tag "v1.0.0"`
      );
    });
  });
});
