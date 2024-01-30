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

describe('nx release git operations', () => {
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
  });
  afterAll(() => cleanupProject());

  it('should stage, commit, and tag by default', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2, pkg3],
      };
      return nxJson;
    });

    const releaseOutput1 = runCLI(`release patch --first-release -d`);

    expect(
      releaseOutput1.match(
        new RegExp('NX   Staging changed files with git', 'g')
      ).length
    ).toEqual(2);
    expect(
      releaseOutput1.match(new RegExp('NX   Committing changes with git', 'g'))
        .length
    ).toEqual(1);
    expect(
      releaseOutput1.match(new RegExp('NX   Tagging commit with git', 'g'))
        .length
    ).toEqual(1);
  });

  it('should error when granular config is set and top level command is run', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2, pkg3],
        version: {
          git: {
            commit: true,
            tag: true,
          },
        },
        changelog: {
          git: {
            commit: false,
            tag: false,
          },
        },
      };
      return nxJson;
    });

    const releaseOutput1 = runCLI(`release patch --first-release -d`, {
      silenceError: true,
    });

    expect(
      releaseOutput1.match(
        new RegExp(
          `The "release" top level command cannot be used with granular git configuration. Instead, configure git options in the "release.git" property in nx.json, or use the version, changelog, and publish subcommands or programmatic API directly.`,
          'g'
        )
      ).length
    ).toEqual(1);
  });

  it('should error when top level git config is set and subcommands are run', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2, pkg3],
        git: {
          commit: true,
          tag: true,
          stageChanges: false,
        },
      };
      return nxJson;
    });

    const releaseVersionOutput = runCLI(
      `release version patch --first-release -d`,
      {
        silenceError: true,
      }
    );

    expect(
      releaseVersionOutput.match(
        new RegExp(
          `The "release.git" property in nx.json may not be used with the "nx release version" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
          'g'
        )
      ).length
    ).toEqual(1);

    const releaseChangelogOutput = runCLI(
      `release changelog 1.0.0 --first-release -d`,
      {
        silenceError: true,
      }
    );

    expect(
      releaseChangelogOutput.match(
        new RegExp(
          `The "release.git" property in nx.json may not be used with the "nx release changelog" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
          'g'
        )
      ).length
    ).toEqual(1);
  });

  it('should stage, but not commit or tag, if stageChanges is true but commit and tag are false', () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2, pkg3],
        git: {
          commit: false,
          tag: false,
          stageChanges: true,
        },
      };
      return nxJson;
    });

    const releaseOutput1 = runCLI(`release patch --first-release -d`);

    expect(
      releaseOutput1.match(
        new RegExp('NX   Staging changed files with git', 'g')
      ).length
    ).toEqual(2);
    expect(
      releaseOutput1.match(new RegExp('NX   Committing changes with git', 'g'))
    ).toBeNull();
    expect(
      releaseOutput1.match(new RegExp('NX   Tagging commit with git', 'g'))
    ).toBeNull();
  });

  it('should not stage, commit, or tag if commit and tag are false and stageChanges is unspecified', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2, pkg3],
        git: {
          commit: false,
          tag: false,
        },
      };
      return nxJson;
    });

    const releaseOutput1 = runCLI(`release patch --first-release -d`);

    expect(
      releaseOutput1.match(
        new RegExp('NX   Staging changed files with git', 'g')
      )
    ).toBeNull();
    expect(
      releaseOutput1.match(new RegExp('NX   Committing changes with git', 'g'))
    ).toBeNull();
    expect(
      releaseOutput1.match(new RegExp('NX   Tagging commit with git', 'g'))
    ).toBeNull();
  });
});
