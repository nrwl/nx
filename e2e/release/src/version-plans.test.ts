import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  exists,
  newProject,
  packageInstall,
  runCLI,
  runCommand,
  runCommandAsync,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e/utils';
import { ensureDir, readdirSync, writeFile } from 'fs-extra';
import { join } from 'path';

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

describe('nx release version plans', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let pkg4: string;
  let pkg5: string;

  beforeEach(async () => {
    newProject({
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

    pkg5 = uniq('my-pkg-5');
    runCLI(`generate @nx/workspace:npm-package ${pkg5}`);

    // Normalize git committer information so it is deterministic in snapshots
    await runCommandAsync(`git config user.email "test@test.com"`);
    await runCommandAsync(`git config user.name "Test"`);

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);
    await runCommandAsync(`git tag -a v0.0.0 -m "v0.0.0"`);
    await runCommandAsync(`git tag -a ${pkg3}@0.0.0 -m "${pkg3}@0.0.0"`);
    await runCommandAsync(`git tag -a ${pkg4}@0.0.0 -m "${pkg4}@0.0.0"`);
    await runCommandAsync(`git tag -a ${pkg5}@0.0.0 -m "${pkg5}@0.0.0"`);
  }, 60000);

  afterEach(() => cleanupProject());

  it('should pick new versions based on version plans', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
            releaseTagPattern: 'v{version}',
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
            releaseTagPattern: '{projectName}@{version}',
          },
        },
        version: {
          generatorOptions: {
            specifierSource: 'version-plans',
          },
        },
        changelog: {
          projectChangelogs: true,
        },
        versionPlans: true,
      };
      return nxJson;
    });

    const versionPlansDir = tmpProjPath('.nx/version-plans');

    runCLI(
      'release plan minor -g fixed-group -m "Update the fixed packages with a minor release." --verbose --only-touched=false',
      {
        silenceError: true,
      }
    );

    await writeFile(
      join(versionPlansDir, 'bump-independent.md'),
      `---
${pkg3}: patch
${pkg4}: preminor
${pkg5}: prerelease
---

Update the independent packages with a patch, preminor, and prerelease.

Here is another line in the message.
`
    );

    await runCommandAsync(`git add ${versionPlansDir}`);
    await runCommandAsync(
      `git commit -m "chore: add version plans for fixed and independent groups"`
    );

    const result = runCLI('release --verbose --skip-publish', {
      silenceError: true,
    });

    expect(result).toContain(
      `${pkg1} 📄 Resolved the specifier as "minor" using version plans.`
    );
    // pkg2 uses the previously resolved specifier from pkg1
    expect(result).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );
    expect(result).toContain(
      `${pkg3} 📄 Resolved the specifier as "patch" using version plans.`
    );
    expect(result).toContain(
      `${pkg4} 📄 Resolved the specifier as "preminor" using version plans.`
    );
    expect(result).toContain(
      `${pkg5} 📄 Resolved the specifier as "prerelease" using version plans.`
    );

    // replace the date with a placeholder to make the snapshot deterministic
    const resultWithoutDate = result.replace(
      /\(\d{4}-\d{2}-\d{2}\)/g,
      '(YYYY-MM-DD)'
    );

    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg1}/CHANGELOG.md for v0.1.0


+ ## 0.1.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the fixed packages with a minor release.
+
+ ### ❤️  Thank You
+
+ - Test`
    );
    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg2}/CHANGELOG.md for v0.1.0


+ ## 0.1.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the fixed packages with a minor release.
+
+ ### ❤️  Thank You
+
+ - Test`
    );
    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg3}/CHANGELOG.md for ${pkg3}@0.0.1


+ ## 0.0.1 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update the independent packages with a patch, preminor, and prerelease.
+
+   Here is another line in the message.
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg4}/CHANGELOG.md for ${pkg4}@0.1.0-0


+ ## 0.1.0-0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the independent packages with a patch, preminor, and prerelease.
+
+   Here is another line in the message.
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg5}/CHANGELOG.md for ${pkg5}@0.0.1-0


+ ## 0.0.1-0 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update the independent packages with a patch, preminor, and prerelease.
+
+   Here is another line in the message.
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    await writeFile(
      join(versionPlansDir, 'bump-mixed1.md'),
      `---
${pkg1}: minor
${pkg3}: patch
---

Update packages in both groups with a mix #1
`
    );
    await writeFile(
      join(versionPlansDir, 'bump-mixed2.md'),
      `---
fixed-group: patch
${pkg4}: preminor
${pkg5}: patch
---

Update packages in both groups with a mix #2
`
    );

    await runCommandAsync(`git add ${join(versionPlansDir, 'bump-mixed1.md')}`);
    await runCommandAsync(`git add ${join(versionPlansDir, 'bump-mixed2.md')}`);
    await runCommandAsync(
      `git commit -m "chore: add combined groups version plans"`
    );

    runCLI('release --dry-run');
    // dry-run should not remove the version plan
    expect(exists(join(versionPlansDir, 'bump-mixed1.md'))).toBeTruthy();

    const result2 = runCLI('release --verbose', {
      silenceError: true,
    });

    expect(result2).toContain(
      `${pkg1} 📄 Resolved the specifier as "minor" using version plans.`
    );
    // pkg2 uses the previously resolved specifier from pkg1
    expect(result2).toContain(
      `${pkg2} ✍️  New version 0.2.0 written to ${pkg2}/package.json`
    );
    expect(result2).toContain(
      `${pkg3} 📄 Resolved the specifier as "patch" using version plans.`
    );
    expect(result2).toContain(
      `${pkg4} 📄 Resolved the specifier as "preminor" using version plans.`
    );
    expect(result2).toContain(
      `${pkg5} 📄 Resolved the specifier as "patch" using version plans.`
    );

    // replace the date with a placeholder to make the snapshot deterministic
    const result2WithoutDate = result2.replace(
      /\(\d{4}-\d{2}-\d{2}\)/g,
      '(YYYY-MM-DD)'
    );

    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg1}/CHANGELOG.md for v0.2.0



+ ## 0.2.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update packages in both groups with a mix #1
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test`
    );
    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg2}/CHANGELOG.md for v0.2.0



+ ## 0.2.0 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test
`
    );
    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg3}/CHANGELOG.md for ${pkg3}@0.0.2



+ ## 0.0.2 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #1
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg4}/CHANGELOG.md for ${pkg4}@0.2.0-0



+ ## 0.2.0-0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg5}/CHANGELOG.md for ${pkg5}@0.0.1



+ ## 0.0.1 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(exists(join(versionPlansDir, 'bump-mixed1.md'))).toBeFalsy();
  });

  it('should pick new versions based on version plans using programmatic api', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
            releaseTagPattern: 'v{version}',
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
            releaseTagPattern: '{projectName}@{version}',
          },
        },
        version: {
          generatorOptions: {
            specifierSource: 'version-plans',
          },
        },
        changelog: {
          projectChangelogs: true,
        },
        versionPlans: true,
      };
      return nxJson;
    });

    const versionPlansDir = tmpProjPath('.nx/version-plans');
    await ensureDir(versionPlansDir);

    await writeFile(
      join(versionPlansDir, 'bump-fixed.md'),
      `---
fixed-group: minor
---

Update the fixed packages with a minor release.
`
    );

    await writeFile(
      join(versionPlansDir, 'bump-independent.md'),
      `---
${pkg3}: patch
${pkg4}: preminor
${pkg5}: prerelease
---

Update the independent packages with a patch, preminor, and prerelease.
`
    );

    expect(exists(join(versionPlansDir, 'bump-fixed.md'))).toBe(true);
    expect(exists(join(versionPlansDir, 'bump-independent.md'))).toBe(true);

    packageInstall('yargs', null, 'latest', 'dev');

    await writeFile(
      tmpProjPath('release.js'),
      `
const { releaseChangelog, releasePublish, releaseVersion } = require('nx/release');
const yargs = require('yargs');

(async () => {
  const options = await yargs
    .version(false) // don't use the default meaning of version in yargs
    .option('version', {
      description:
        'Explicit version specifier to use, if overriding conventional commits',
      type: 'string',
    })
    .option('dryRun', {
      alias: 'd',
      description:
        'Whether or not to perform a dry-run of the release process, defaults to true',
      type: 'boolean',
    })
    .option('verbose', {
      description:
        'Whether or not to enable verbose logging, defaults to false',
      type: 'boolean',
      default: false,
    })
    .parseAsync();

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    specifier: options.version,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  const publishProjectsResult = await releasePublish({
    dryRun: options.dryRun,
    verbose: options.verbose,
  });
  // Derive an overall exit code from the publish projects result
  process.exit(
    Object.values(publishProjectsResult).every((result) => result.code === 0)
      ? 0
      : 1
  );
})();
`
    );

    await runCommandAsync(`git add ${join(versionPlansDir, 'bump-fixed.md')}`);
    await runCommandAsync(
      `git add ${join(versionPlansDir, 'bump-independent.md')}`
    );
    await runCommandAsync(
      `git commit -m "chore: add version plans for fixed and independent groups"`
    );

    const result = runCommand('node release.js', {
      failOnError: false,
    });

    expect(result).toContain(
      `${pkg1} 📄 Resolved the specifier as "minor" using version plans.`
    );
    // pkg2 uses the previously resolved specifier from pkg1
    expect(result).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );
    expect(result).toContain(
      `${pkg3} 📄 Resolved the specifier as "patch" using version plans.`
    );
    expect(result).toContain(
      `${pkg4} 📄 Resolved the specifier as "preminor" using version plans.`
    );
    expect(result).toContain(
      `${pkg5} 📄 Resolved the specifier as "prerelease" using version plans.`
    );

    // replace the date with a placeholder to make the snapshot deterministic
    const resultWithoutDate = result.replace(
      /\(\d{4}-\d{2}-\d{2}\)/g,
      '(YYYY-MM-DD)'
    );

    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg1}/CHANGELOG.md for v0.1.0


+ ## 0.1.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the fixed packages with a minor release.
+
+ ### ❤️  Thank You
+
+ - Test`
    );
    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg2}/CHANGELOG.md for v0.1.0


+ ## 0.1.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the fixed packages with a minor release.
+
+ ### ❤️  Thank You
+
+ - Test`
    );
    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg3}/CHANGELOG.md for ${pkg3}@0.0.1


+ ## 0.0.1 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update the independent packages with a patch, preminor, and prerelease.
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg4}/CHANGELOG.md for ${pkg4}@0.1.0-0


+ ## 0.1.0-0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the independent packages with a patch, preminor, and prerelease.
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(resultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg5}/CHANGELOG.md for ${pkg5}@0.0.1-0


+ ## 0.0.1-0 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update the independent packages with a patch, preminor, and prerelease.
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(exists(join(versionPlansDir, 'bump-fixed.md'))).toBeFalsy();
    expect(exists(join(versionPlansDir, 'bump-independent.md'))).toBeFalsy();

    await writeFile(
      join(versionPlansDir, 'bump-mixed1.md'),
      `---
${pkg1}: minor
${pkg3}: patch
---

Update packages in both groups with a mix #1
  `
    );
    await writeFile(
      join(versionPlansDir, 'bump-mixed2.md'),
      `---
fixed-group: patch
${pkg4}: preminor
${pkg5}: patch
---

Update packages in both groups with a mix #2
  `
    );

    await runCommandAsync(`git add ${join(versionPlansDir, 'bump-mixed1.md')}`);
    await runCommandAsync(`git add ${join(versionPlansDir, 'bump-mixed2.md')}`);
    await runCommandAsync(
      `git commit -m "chore: add combined groups version plans"`
    );

    runCLI('release --dry-run');
    // dry-run should not remove the version plan
    expect(exists(join(versionPlansDir, 'bump-mixed1.md'))).toBeTruthy();

    const result2 = runCLI('release --verbose --skip-publish', {
      silenceError: true,
    });

    expect(result2).toContain(
      `${pkg1} 📄 Resolved the specifier as "minor" using version plans.`
    );
    // pkg2 uses the previously resolved specifier from pkg1
    expect(result2).toContain(
      `${pkg2} ✍️  New version 0.2.0 written to ${pkg2}/package.json`
    );
    expect(result2).toContain(
      `${pkg3} 📄 Resolved the specifier as "patch" using version plans.`
    );
    expect(result2).toContain(
      `${pkg4} 📄 Resolved the specifier as "preminor" using version plans.`
    );
    expect(result2).toContain(
      `${pkg5} 📄 Resolved the specifier as "patch" using version plans.`
    );

    // replace the date with a placeholder to make the snapshot deterministic
    const result2WithoutDate = result2.replace(
      /\(\d{4}-\d{2}-\d{2}\)/g,
      '(YYYY-MM-DD)'
    );

    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg1}/CHANGELOG.md for v0.2.0



+ ## 0.2.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update packages in both groups with a mix #1
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test`
    );
    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg2}/CHANGELOG.md for v0.2.0



+ ## 0.2.0 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test
`
    );
    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg3}/CHANGELOG.md for ${pkg3}@0.0.2



+ ## 0.0.2 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #1
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg4}/CHANGELOG.md for ${pkg4}@0.2.0-0



+ ## 0.2.0-0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(result2WithoutDate).toContain(
      `NX   Generating an entry in ${pkg5}/CHANGELOG.md for ${pkg5}@0.0.1



+ ## 0.0.1 (YYYY-MM-DD)
+
+ ### 🩹 Fixes
+
+ - Update packages in both groups with a mix #2
+
+ ### ❤️  Thank You
+
+ - Test`
    );

    expect(exists(join(versionPlansDir, 'bump-mixed1.md'))).toBeFalsy();
  });

  it('should pick new versions based on version plans using subcommands', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projects: [pkg1, pkg2],
        releaseTagPattern: 'v{version}',
        changelog: {
          projectChangelogs: true,
        },
        versionPlans: true,
      };
      return nxJson;
    });

    const versionPlansDir = tmpProjPath('.nx/version-plans');
    await ensureDir(versionPlansDir);

    runCLI(
      'release plan minor -m "Update the fixed packages with a minor release." --verbose --only-touched=false',
      {
        silenceError: true,
      }
    );

    // don't commit the new version plan file - it should still be picked up by the release command and deleted appropriately

    const versionResult = runCLI('release version --verbose', {
      silenceError: true,
    });

    expect(versionResult).toContain(
      `${pkg1} 📄 Resolved the specifier as "minor" using version plans.`
    );
    // pkg2 uses the previously resolved specifier from pkg1
    expect(versionResult).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );

    const changelogResult = runCLI('release changelog 0.1.0 --verbose', {
      silenceError: true,
    });

    const changelogResultWithoutDate = changelogResult.replace(
      /\(\d{4}-\d{2}-\d{2}\)/g,
      '(YYYY-MM-DD)'
    );

    expect(changelogResultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg1}/CHANGELOG.md for v0.1.0


+ ## 0.1.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the fixed packages with a minor release.`
    );
    expect(changelogResultWithoutDate).toContain(
      `NX   Generating an entry in ${pkg2}/CHANGELOG.md for v0.1.0


+ ## 0.1.0 (YYYY-MM-DD)
+
+ ### 🚀 Features
+
+ - Update the fixed packages with a minor release.`
    );

    expect(readdirSync(versionPlansDir)).toEqual([]);
  });

  it('version command should bypass version plans when a specifier is passed', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
            releaseTagPattern: 'v{version}',
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
            releaseTagPattern: '{projectName}@{version}',
          },
        },
        version: {
          generatorOptions: {
            specifierSource: 'version-plans',
          },
        },
        changelog: {
          projectChangelogs: true,
        },
        versionPlans: true,
      };
      return nxJson;
    });

    runCLI(
      'release plan minor -g fixed-group -m "Update the fixed packages with another minor release." --verbose --only-touched=false',
      {
        silenceError: true,
      }
    );

    runCLI(
      'release plan minor -g independent-group -m "Update the independent packages with another minor release." --verbose --only-touched=false',
      {
        silenceError: true,
      }
    );

    const versionPlansDir = tmpProjPath('.nx/version-plans');
    await runCommandAsync(`git add ${versionPlansDir}`);
    await runCommandAsync(
      `git commit -m "chore: add version plans for fixed and independent groups again"`
    );

    const releaseResult = runCLI('release major --verbose --skip-publish', {
      silenceError: true,
    });

    expect(releaseResult).toContain(
      `NX   A specifier option cannot be provided when using version plans.`
    );
    expect(releaseResult).toContain(
      `To override this behavior, use the Nx Release programmatic API directly (https://nx.dev/features/manage-releases#using-the-programmatic-api-for-nx-release).`
    );

    const versionResult = runCLI('release version major --verbose', {
      silenceError: true,
    });

    expect(versionResult).toContain(
      'Skipping version plan discovery as a specifier was provided'
    );
    expect(versionResult).toContain(
      `${pkg1} 📄 Using the provided version specifier "major".`
    );
    expect(versionResult).toContain(
      `${pkg2} 📄 Using the provided version specifier "major".`
    );
    expect(versionResult).toContain(
      `${pkg3} 📄 Using the provided version specifier "major".`
    );
    expect(versionResult).toContain(
      `${pkg4} 📄 Using the provided version specifier "major".`
    );
    expect(versionResult).toContain(
      `${pkg5} 📄 Using the provided version specifier "major".`
    );

    expect(versionResult).toContain(
      `git add ${pkg1}/package.json ${pkg2}/package.json ${pkg3}/package.json ${pkg4}/package.json ${pkg5}/package.json`
    );

    expect(readdirSync(versionPlansDir).length).toEqual(2);
  });
});
