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

describe('nx release conventional commits config', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let pkg4: string;

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

    pkg4 = uniq('my-pkg-4');
    runCLI(`generate @nx/workspace:npm-package ${pkg4}`);

    // Update pkg2 to depend on pkg1
    updateJson(`${pkg2}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${pkg1}`] = '0.0.0';
      return json;
    });

    // no git config so that the test ensures git operations happen by default
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projectsRelationship: 'independent',
      };
      return nxJson;
    });

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);
    await runCommandAsync(`git tag -a ${pkg1}@0.0.1 -m "${pkg1}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg2}@0.0.1 -m "${pkg2}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg3}@0.0.1 -m "${pkg3}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg4}@0.0.1 -m "${pkg4}@0.0.1"`);
  }, 60000);
  afterAll(() => cleanupProject());

  it('should respect custom conventional commits configuration', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        ...json.release,
        version: {
          conventionalCommits: true,
        },
        changelog: {
          projectChangelogs: {
            renderOptions: {
              authors: false, // do not show authors in the e2e snapshots
            },
          },
        },
        conventionalCommits: {
          types: {
            fix: false,
            docs: {
              semverBump: 'patch',
              changelog: {
                hidden: false,
                title: 'Custom Docs Header',
              },
            },
            customType: {
              semverBump: 'minor',
              changelog: {
                title: 'Custom Type',
              },
            },
            // unspecified semverBump will default to "patch"
            chore: {
              // "changelog.hidden" defaults to true, but setting changelog: false
              // is a shortcut for setting "changelog.hidden" to false.
              changelog: false,
            },
          },
        },
      };
      return json;
    });

    // update my-pkg-1 with a fix commit
    updateJson(`${pkg1}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    await runCommandAsync(`git add ${pkg1}/package.json`);
    await runCommandAsync(`git commit -m "fix: this is a fix"`);

    const versionResultNoChanges = runCLI(`release version -d`);

    expect(versionResultNoChanges).toContain(
      `${pkg1} 🚫 Skipping versioning "@proj/${pkg1}" as no changes were detected.`
    );
    expect(versionResultNoChanges).toContain(
      `${pkg2} 🚫 Skipping versioning "@proj/${pkg2}" as no changes were detected.`
    );
    expect(versionResultNoChanges).toContain(
      `${pkg3} 🚫 Skipping versioning "@proj/${pkg3}" as no changes were detected.`
    );
    expect(versionResultNoChanges).toContain(
      `${pkg4} 🚫 Skipping versioning "@proj/${pkg4}" as no changes were detected.`
    );

    // update my-pkg-3 with a fix commit
    updateJson(`${pkg3}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    await runCommandAsync(`git add ${pkg3}/package.json`);
    await runCommandAsync(`git commit -m "docs: this is a doc"`);

    const versionResultDocsChanges = runCLI(`release version -d`);

    expect(versionResultDocsChanges).toContain(
      `${pkg1} 🚫 Skipping versioning "@proj/${pkg1}" as no changes were detected.`
    );
    expect(versionResultDocsChanges).toContain(
      `${pkg2} 🚫 Skipping versioning "@proj/${pkg2}" as no changes were detected.`
    );
    expect(versionResultDocsChanges).toContain(
      `${pkg3} ✍️  New version 0.0.2 written to ${pkg3}/package.json`
    );
    expect(versionResultNoChanges).toContain(
      `${pkg4} 🚫 Skipping versioning "@proj/${pkg4}" as no changes were detected.`
    );

    // update my-pkg-2 with a fix commit
    updateJson(`${pkg2}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    await runCommandAsync(`git add ${pkg2}/package.json`);
    await runCommandAsync(
      `git commit -m "customType(${pkg2}): this is a custom type"`
    );

    const versionResultCustomTypeChanges = runCLI(`release version -d`);
    expect(versionResultCustomTypeChanges).toContain(
      `${pkg1} 🚫 Skipping versioning "@proj/${pkg1}" as no changes were detected.`
    );
    expect(versionResultCustomTypeChanges).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );
    expect(versionResultCustomTypeChanges).toContain(
      `${pkg3} ✍️  New version 0.0.2 written to ${pkg3}/package.json`
    );
    expect(versionResultNoChanges).toContain(
      `${pkg4} 🚫 Skipping versioning "@proj/${pkg4}" as no changes were detected.`
    );

    updateJson(`${pkg1}/package.json`, (json) => ({
      ...json,
      license: 'UNLICENSED',
    }));
    await runCommandAsync(`git add ${pkg1}/package.json`);
    await runCommandAsync(
      `git commit -m "customType(${pkg1})!: this is a breaking change"`
    );

    const versionResultCustomTypeBreakingChanges = runCLI(`release version -d`);
    expect(versionResultCustomTypeBreakingChanges).toContain(
      `${pkg1} ✍️  New version 1.0.0 written to ${pkg1}/package.json`
    );
    expect(versionResultCustomTypeBreakingChanges).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );
    expect(versionResultCustomTypeBreakingChanges).toContain(
      `${pkg3} ✍️  New version 0.0.2 written to ${pkg3}/package.json`
    );
    expect(versionResultNoChanges).toContain(
      `${pkg4} 🚫 Skipping versioning "@proj/${pkg4}" as no changes were detected.`
    );

    updateJson(`${pkg4}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    await runCommandAsync(`git add ${pkg4}/package.json`);
    await runCommandAsync(`git commit -m "chore: this is a chore"`);

    const versionResultChoreChanges = runCLI(`release version -d`);
    expect(versionResultChoreChanges).toContain(
      `${pkg1} ✍️  New version 1.0.0 written to ${pkg1}/package.json`
    );
    expect(versionResultChoreChanges).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );
    expect(versionResultChoreChanges).toContain(
      `${pkg3} ✍️  New version 0.0.2 written to ${pkg3}/package.json`
    );
    expect(versionResultCustomTypeBreakingChanges).toContain(
      `${pkg3} ✍️  New version 0.0.2 written to ${pkg3}/package.json`
    );

    // Normally, users would use `nx release` or the programmatic api to ensure that
    // changelogs are generated for the above version bumps, but for the sake of this
    // test, we just want to ensure that each commit is included/excluded as expected.
    // Therefore, any version number will work - in this case it's 1.0.0.
    const changelogResult = runCLI(`release changelog 1.0.0 -d`);

    // NOTE: pkg4 should not have changes here, since its only commit is a chore.
    // Chore commits are hidden from changelogs in the above config via `changelog: false`.
    expect(changelogResult).toMatchInlineSnapshot(`

      NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@1.0.0


      + # 1.0.0 (YYYY-MM-DD)
      +
      +
      + ### Custom Type
      +
      + - **{project-name}:** this is a custom type


      NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@1.0.0


      + # 1.0.0 (YYYY-MM-DD)
      +
      +
      + ### Custom Docs Header
      +
      + - this is a doc


      NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@1.0.0


      + # 1.0.0 (YYYY-MM-DD)
      +
      + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


      NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@1.0.0


      + # 1.0.0 (YYYY-MM-DD)
      +
      +
      + ### Custom Type
      +
      + - ⚠️  **{project-name}:** this is a breaking change
      +
      +
      + #### ⚠️  Breaking Changes
      +
      + - ⚠️  **{project-name}:** this is a breaking change


      NX   Committing changes with git


      NX   Tagging commit with git


    `);
  });
});
