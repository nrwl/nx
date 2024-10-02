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

describe('nx release create github release', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

  beforeAll(async () => {
    newProject({
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

    // Normalize git committer information so it is deterministic in snapshots
    await runCommandAsync(`git config user.email "test@test.com"`);
    await runCommandAsync(`git config user.name "Test"`);

    // update my-pkg-1 with a fix commit
    updateJson(`${pkg1}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    await runCommandAsync(`git add ${pkg1}/package.json`);
    await runCommandAsync(`git commit -m "fix(${pkg1}): fix 1"`);

    // update my-pkg-2 with a breaking change
    updateJson(`${pkg2}/package.json`, (json) => ({
      ...json,
      license: 'GNU GPLv3',
    }));
    await runCommandAsync(`git add ${pkg2}/package.json`);
    await runCommandAsync(`git commit -m "feat(${pkg2})!: breaking change 2"`);

    // update my-pkg-3 with a feature commit
    updateJson(`${pkg3}/package.json`, (json) => ({
      ...json,
      license: 'GNU GPLv3',
    }));
    await runCommandAsync(`git add ${pkg3}/package.json`);
    await runCommandAsync(`git commit -m "feat(${pkg3}): feat 3"`);

    // We need a valid git origin to exist for the commit references to work (and later the test for createRelease)
    await runCommandAsync(
      `git remote add origin https://github.com/nrwl/fake-repo.git`
    );
  });
  afterAll(() => cleanupProject());

  it('should create github release for the first release', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        changelog: {
          workspaceChangelog: {
            createRelease: 'github',
          },
        },
      };
      return nxJson;
    });
    const result = runCLI('release patch -d --first-release --verbose');

    expect(
      result.match(new RegExp(`NX   Pushing to git remote`, 'g')).length
    ).toEqual(1);
    expect(
      result.match(new RegExp(`NX   Creating GitHub Release`, 'g')).length
    ).toEqual(1);

    // should have two occurrences of each - one for the changelog file, one for the github release
    expect(result.match(new RegExp(`### 🚀 Features`, 'g')).length).toEqual(2);
    expect(result.match(new RegExp(`### 🩹 Fixes`, 'g')).length).toEqual(2);
    expect(
      result.match(new RegExp(`### ⚠️  Breaking Changes`, 'g')).length
    ).toEqual(2);
  });

  it('should create github releases for all independent packages', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projectsRelationship: 'independent',
        version: {
          conventionalCommits: true,
        },
        changelog: {
          projectChangelogs: {
            file: false,
            createRelease: 'github',
          },
        },
      };
      return nxJson;
    });

    const result = runCLI('release -d --first-release --verbose');

    expect(
      result.match(new RegExp(`NX   Pushing to git remote`, 'g')).length
    ).toEqual(1);
    expect(
      result.match(new RegExp(`NX   Creating GitHub Release`, 'g')).length
    ).toEqual(3);

    // should have one occurrence of each because files are disabled
    expect(result.match(new RegExp(`### 🚀 Features`, 'g')).length).toEqual(2);
    expect(result.match(new RegExp(`### 🩹 Fixes`, 'g')).length).toEqual(1);
    expect(
      result.match(new RegExp(`### ⚠️  Breaking Changes`, 'g')).length
    ).toEqual(1);
  });
});
