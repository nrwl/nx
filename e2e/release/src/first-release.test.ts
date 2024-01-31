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

describe('nx release first run', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

  beforeAll(async () => {
    newProject({
      unsetProjectNameAndRootFormat: false,
      packages: ['@nx/js'],
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${pkg1}`);

    pkg2 = uniq('my-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${pkg2}`);

    pkg3 = uniq('my-pkg-3');
    runCLI(`generate @nx/workspace:npm-package ${pkg3}`);

    // Update pkg2 to depend on pkg1
    updateJson(`${pkg2}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${pkg1}`] = '0.0.0';
      return json;
    });

    // no git config so that the test ensures git operations happen by default
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2, pkg3],
      };
      return nxJson;
    });

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);
  }, 60000);
  afterAll(() => cleanupProject());

  describe('without --first-release', () => {
    it('should error', async () => {
      const releaseOutput1 = runCLI(`release patch --skip-publish -d`, {
        silenceError: true,
      });

      expect(
        releaseOutput1.match(
          new RegExp(
            `NX   Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTagPattern" property in nx.json to match the structure of your repository's git tags.`,
            'g'
          )
        ).length
      ).toEqual(1);
    });
  });

  describe('with --first-release', () => {
    it('should not error', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
        };
        return nxJson;
      });

      const releaseOutput1 = runCLI(
        `release patch --verbose --first-release -y -d`
      );

      expect(
        releaseOutput1.match(
          new RegExp('NX   Staging changed files with git', 'g')
        ).length
      ).toEqual(2);
      expect(
        releaseOutput1.match(
          new RegExp('NX   Committing changes with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput1.match(new RegExp('NX   Tagging commit with git', 'g'))
          .length
      ).toEqual(1);
      expect(
        releaseOutput1.match(
          new RegExp('Skipped npm view because --first-release was set', 'g')
        ).length
      ).toEqual(3);

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          projectsRelationship: 'independent',
          changelog: {
            projectChangelogs: {},
          },
        };
        return nxJson;
      });

      const releaseOutput2 = runCLI(
        `release patch --verbose --first-release -y -d`
      );

      expect(
        releaseOutput2.match(
          new RegExp('NX   Staging changed files with git', 'g')
        ).length
      ).toEqual(2);
      expect(
        releaseOutput2.match(
          new RegExp('NX   Committing changes with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput2.match(new RegExp('NX   Tagging commit with git', 'g'))
          .length
      ).toEqual(1);
      expect(
        releaseOutput2.match(
          new RegExp('Skipped npm view because --first-release was set', 'g')
        ).length
      ).toEqual(3);
    });

    it('should not error when changelog is disabled', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          changelog: {
            workspaceChangelog: false,
          },
        };
        return nxJson;
      });

      const releaseOutput1 = runCLI(
        `release patch --verbose --first-release -y -d`
      );

      expect(
        releaseOutput1.match(
          new RegExp('NX   Staging changed files with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput1.match(
          new RegExp('NX   Committing changes with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput1.match(new RegExp('NX   Tagging commit with git', 'g'))
          .length
      ).toEqual(1);
      expect(
        releaseOutput1.match(
          new RegExp('Skipped npm view because --first-release was set', 'g')
        ).length
      ).toEqual(3);

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          projectsRelationship: 'independent',
          changelog: {
            workspaceChangelog: false,
          },
        };
        return nxJson;
      });

      const releaseOutput2 = runCLI(
        `release patch --verbose --first-release -y -d`
      );

      expect(
        releaseOutput2.match(
          new RegExp('NX   Staging changed files with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput2.match(
          new RegExp('NX   Committing changes with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput2.match(new RegExp('NX   Tagging commit with git', 'g'))
          .length
      ).toEqual(1);
      expect(
        releaseOutput2.match(
          new RegExp('Skipped npm view because --first-release was set', 'g')
        ).length
      ).toEqual(3);
    });
  });

  describe('with config options fallbackCurrentVersionResolver and automaticFromRef', () => {
    it('should not error', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          version: {
            generatorOptions: {
              fallbackCurrentVersionResolver: 'disk',
            },
          },
        };

        return nxJson;
      });

      const releaseOutput1 = runCLI(`release patch --verbose -y -d`, {
        silenceError: true,
      });

      expect(
        releaseOutput1.match(
          new RegExp(
            `NX   Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTagPattern" property in nx.json to match the structure of your repository's git tags.`,
            'g'
          )
        ).length
      ).toEqual(1);

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          version: {
            generatorOptions: {
              fallbackCurrentVersionResolver: 'disk',
            },
          },
          changelog: {
            automaticFromRef: true,
          },
        };

        return nxJson;
      });

      const releaseOutput2 = runCLI(`release patch --skip-publish -d`);

      expect(
        releaseOutput2.match(
          new RegExp('NX   Staging changed files with git', 'g')
        ).length
      ).toEqual(2);
      expect(
        releaseOutput2.match(
          new RegExp('NX   Committing changes with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput2.match(new RegExp('NX   Tagging commit with git', 'g'))
          .length
      ).toEqual(1);

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          projectsRelationship: 'independent',
          version: {
            generatorOptions: {
              fallbackCurrentVersionResolver: 'disk',
            },
          },
          changelog: {
            projectChangelogs: {},
          },
        };

        return nxJson;
      });

      const releaseOutput3 = runCLI(`release patch --verbose -y -d`, {
        silenceError: true,
      });

      expect(
        releaseOutput3.match(
          new RegExp(
            `NX   Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTagPattern" property in nx.json to match the structure of your repository's git tags.`,
            'g'
          )
        ).length
      ).toEqual(1);

      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projects: [pkg1, pkg2, pkg3],
          projectsRelationship: 'independent',
          version: {
            generatorOptions: {
              fallbackCurrentVersionResolver: 'disk',
            },
          },
          changelog: {
            automaticFromRef: true,
            projectChangelogs: {},
          },
        };

        return nxJson;
      });

      const releaseOutput4 = runCLI(`release patch --skip-publish -d`);

      expect(
        releaseOutput4.match(
          new RegExp('NX   Staging changed files with git', 'g')
        ).length
      ).toEqual(2);
      expect(
        releaseOutput4.match(
          new RegExp('NX   Committing changes with git', 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput4.match(new RegExp('NX   Tagging commit with git', 'g'))
          .length
      ).toEqual(1);
    });
  });
});
