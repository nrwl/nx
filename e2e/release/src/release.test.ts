import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  createFile,
  exists,
  killProcessAndPorts,
  newProject,
  readFile,
  runCLI,
  runCommandAsync,
  runCommandUntil,
  uniq,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';

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

describe('nx release', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

  beforeAll(() => {
    newProject({
      unsetProjectNameAndRootFormat: false,
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
  });
  afterAll(() => cleanupProject());

  it('should version and publish multiple related npm packages with zero config', async () => {
    // Normalize git committer information so it is deterministic in snapshots
    await runCommandAsync(`git config user.email "test@test.com"`);
    await runCommandAsync(`git config user.name "Test"`);
    // Create a baseline version tag
    await runCommandAsync(`git tag v0.0.0`);

    // Add an example feature so that we can generate a CHANGELOG.md for it
    createFile('an-awesome-new-thing.js', 'console.log("Hello world!");');
    await runCommandAsync(
      `git add --all && git commit -m "feat: an awesome new feature"`
    );

    const versionOutput = runCLI(`release version 999.9.9`);

    /**
     * We can't just assert on the whole version output as a snapshot because the order of the projects
     * is non-deterministic, and not every project has the same number of log lines (because of the
     * dependency relationship)
     */
    expect(
      versionOutput.match(/Running release version for project: my-pkg-\d*/g)
        .length
    ).toEqual(3);
    expect(
      versionOutput.match(
        /Reading data for package "@proj\/my-pkg-\d*" from my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);
    expect(
      versionOutput.match(
        /Resolved the current version as 0.0.0 from my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);
    expect(
      versionOutput.match(
        /New version 999.9.9 written to my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);

    // Only one dependency relationship exists, so this log should only match once
    expect(
      versionOutput.match(
        /Applying new version 999.9.9 to 1 package which depends on my-pkg-\d*/g
      ).length
    ).toEqual(1);

    // Generate a changelog for the new version
    expect(exists('CHANGELOG.md')).toEqual(false);

    const changelogOutput = runCLI(`release changelog 999.9.9`);
    expect(changelogOutput).toMatchInlineSnapshot(`

      >  NX   Generating an entry in CHANGELOG.md for v999.9.9


      + ## 999.9.9
      +
      +
      + ### 🚀 Features
      +
      + - an awesome new feature
      +
      + ### ❤️  Thank You
      +
      + - Test


    `);

    expect(readFile('CHANGELOG.md')).toMatchInlineSnapshot(`
      ## 999.9.9


      ### 🚀 Features

      - an awesome new feature

      ### ❤️  Thank You

      - Test
    `);

    // This is the verdaccio instance that the e2e tests themselves are working from
    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();

    // Thanks to the custom serializer above, the publish output should be deterministic
    const publishOutput = runCLI(`release publish`);
    expect(publishOutput).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}



      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       999.9.9
      filename:      proj-{project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       999.9.9
      filename:      proj-{project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       999.9.9
      filename:      proj-{project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      >  NX   Successfully ran target nx-release-publish for 3 projects



    `);

    expect(
      execSync(`npm view @proj/${pkg1} version`).toString().trim()
    ).toEqual('999.9.9');
    expect(
      execSync(`npm view @proj/${pkg2} version`).toString().trim()
    ).toEqual('999.9.9');
    expect(
      execSync(`npm view @proj/${pkg3} version`).toString().trim()
    ).toEqual('999.9.9');

    // Add custom nx release config to control version resolution
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          default: {
            // @proj/source will be added as a project by the verdaccio setup, but we aren't versioning or publishing it, so we exclude it here
            projects: ['*', '!@proj/source'],
            version: {
              generator: '@nx/js:release-version',
              generatorOptions: {
                // Resolve the latest version from the custom registry instance, therefore finding the previously published versions
                currentVersionResolver: 'registry',
                currentVersionResolverMetadata: {
                  registry: e2eRegistryUrl,
                  tag: 'latest',
                },
              },
            },
          },
        },
      };
      return nxJson;
    });

    // Run additional custom verdaccio instance to publish the packages to
    runCLI(`generate setup-verdaccio`);

    const verdaccioPort = 7190;
    const customRegistryUrl = `http://localhost:${verdaccioPort}`;
    const process = await runCommandUntil(
      `local-registry @proj/source --port=${verdaccioPort}`,
      (output) => output.includes(`warn --- http address`)
    );

    const versionOutput2 = runCLI(`release version premajor --preid next`); // version using semver keyword this time (and custom preid)

    expect(
      versionOutput2.match(/Running release version for project: my-pkg-\d*/g)
        .length
    ).toEqual(3);
    expect(
      versionOutput2.match(
        /Reading data for package "@proj\/my-pkg-\d*" from my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);

    // It should resolve the current version from the registry once...
    expect(
      versionOutput2.match(
        new RegExp(
          `Resolved the current version as 999.9.9 for tag "latest" from registry ${e2eRegistryUrl}`,
          'g'
        )
      ).length
    ).toEqual(1);
    // ...and then reuse it twice
    expect(
      versionOutput2.match(
        new RegExp(
          `Using the current version 999.9.9 already resolved from the registry ${e2eRegistryUrl}`,
          'g'
        )
      ).length
    ).toEqual(2);

    expect(
      versionOutput2.match(
        /New version 1000.0.0-next.0 written to my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);

    // Only one dependency relationship exists, so this log should only match once
    expect(
      versionOutput2.match(
        /Applying new version 1000.0.0-next.0 to 1 package which depends on my-pkg-\d*/g
      ).length
    ).toEqual(1);

    // Perform an initial dry-run of the publish to the custom registry (not e2e registry), and a custom dist tag of "next"
    const publishToNext = `release publish --registry=${customRegistryUrl} --tag=next`;
    const publishOutput2 = runCLI(`${publishToNext} --dry-run`);
    expect(publishOutput2).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}

      With additional flags:
      --registry=${customRegistryUrl}
      --tag=next
      --dryRun=true



      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@1000.0.0-next.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       1000.0.0-next.0
      filename:      proj-{project-name}-1000.0.0-next.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Would publish to ${customRegistryUrl} with tag "next", but [dry-run] was set

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@1000.0.0-next.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       1000.0.0-next.0
      filename:      proj-{project-name}-1000.0.0-next.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Would publish to ${customRegistryUrl} with tag "next", but [dry-run] was set

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@1000.0.0-next.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       1000.0.0-next.0
      filename:      proj-{project-name}-1000.0.0-next.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Would publish to ${customRegistryUrl} with tag "next", but [dry-run] was set



      >  NX   Successfully ran target nx-release-publish for 3 projects



  `);

    // Versions are still unpublished on the next tag in the custom registry, because it was only a dry-run
    expect(() =>
      execSync(
        `npm view @proj/${pkg1}@next version --registry=${customRegistryUrl}`
      )
    ).toThrowError(/npm ERR! code E404/);
    expect(() =>
      execSync(
        `npm view @proj/${pkg2}@next version --registry=${customRegistryUrl}`
      )
    ).toThrowError(/npm ERR! code E404/);
    expect(() =>
      execSync(
        `npm view @proj/${pkg3}@next version --registry=${customRegistryUrl}`
      )
    ).toThrowError(/npm ERR! code E404/);

    // Actually publish to the custom registry (not e2e registry), and a custom dist tag of "next"
    const publishOutput3 = runCLI(publishToNext);
    expect(publishOutput3).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}

      With additional flags:
      --registry=${customRegistryUrl}
      --tag=next



      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@1000.0.0-next.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       1000.0.0-next.0
      filename:      proj-{project-name}-1000.0.0-next.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${customRegistryUrl} with tag "next"

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@1000.0.0-next.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       1000.0.0-next.0
      filename:      proj-{project-name}-1000.0.0-next.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${customRegistryUrl} with tag "next"

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@1000.0.0-next.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       1000.0.0-next.0
      filename:      proj-{project-name}-1000.0.0-next.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${customRegistryUrl} with tag "next"



      >  NX   Successfully ran target nx-release-publish for 3 projects



    `);

    // The versions now exist on the next tag in the custom registry
    expect(
      execSync(
        `npm view @proj/${pkg1}@next version --registry=${customRegistryUrl}`
      )
        .toString()
        .trim()
    ).toEqual('1000.0.0-next.0');
    expect(
      execSync(
        `npm view @proj/${pkg2}@next version --registry=${customRegistryUrl}`
      )
        .toString()
        .trim()
    ).toEqual('1000.0.0-next.0');
    expect(
      execSync(
        `npm view @proj/${pkg3}@next version --registry=${customRegistryUrl}`
      )
        .toString()
        .trim()
    ).toEqual('1000.0.0-next.0');

    // Update custom nx release config to demonstrate project level changelogs
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          default: {
            // @proj/source will be added as a project by the verdaccio setup, but we aren't versioning or publishing it, so we exclude it here
            projects: ['*', '!@proj/source'],
            changelog: {
              // This should be merged with and take priority over the projectChangelogs config at the root of the config
              createRelease: 'github',
            },
          },
        },
        changelog: {
          projectChangelogs: {
            renderOptions: {
              createRelease: false, // will be overridden by the group
              // Customize the changelog renderer to not print the Thank You section this time (not overridden by the group)
              includeAuthors: false,
            },
          },
        },
      };
      return nxJson;
    });

    // We need a valid git origin for the command to work when createRelease is set
    await runCommandAsync(
      `git remote add origin https://github.com/nrwl/fake-repo.git`
    );

    // Perform a dry-run this time to show that it works but also prevent making any requests to github within the test
    const changelogDryRunOutput = runCLI(
      `release changelog 1000.0.0-next.0 --dry-run`
    );
    expect(changelogDryRunOutput).toMatchInlineSnapshot(`

      >  NX   Previewing an entry in CHANGELOG.md for v1000.0.0-next.0



      + ## 1000.0.0-next.0
      +
      +
      + ### 🚀 Features
      +
      + - an awesome new feature
      +
      + ### ❤️  Thank You
      +
      + - Test
      +
      ## 999.9.9




      >  NX   Previewing a Github release and an entry in {project-name}/CHANGELOG.md for {project-name}@v1000.0.0-next.0


      + ## 1000.0.0-next.0
      +
      +
      + ### 🚀 Features
      +
      + - an awesome new feature ([{COMMIT_SHA}](https://github.com/nrwl/fake-repo/commit/{COMMIT_SHA}))


      >  NX   Previewing a Github release and an entry in {project-name}/CHANGELOG.md for {project-name}@v1000.0.0-next.0


      + ## 1000.0.0-next.0
      +
      +
      + ### 🚀 Features
      +
      + - an awesome new feature ([{COMMIT_SHA}](https://github.com/nrwl/fake-repo/commit/{COMMIT_SHA}))


      >  NX   Previewing a Github release and an entry in {project-name}/CHANGELOG.md for {project-name}@v1000.0.0-next.0


      + ## 1000.0.0-next.0
      +
      +
      + ### 🚀 Features
      +
      + - an awesome new feature ([{COMMIT_SHA}](https://github.com/nrwl/fake-repo/commit/{COMMIT_SHA}))


    `);

    // port and process cleanup
    await killProcessAndPorts(process.pid, verdaccioPort);

    // Add custom nx release config to control version resolution
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          default: {
            // @proj/source will be added as a project by the verdaccio setup, but we aren't versioning or publishing it, so we exclude it here
            projects: ['*', '!@proj/source'],
            releaseTagPattern: 'xx{version}',
            version: {
              generator: '@nx/js:release-version',
              generatorOptions: {
                // Resolve the latest version from the git tag
                currentVersionResolver: 'git-tag',
              },
            },
          },
        },
      };
      return nxJson;
    });

    // Add a git tag to the repo
    await runCommandAsync(`git tag xx1100.0.0`);

    const versionOutput3 = runCLI(`release version minor`);
    expect(
      versionOutput3.match(/Running release version for project: my-pkg-\d*/g)
        .length
    ).toEqual(3);
    expect(
      versionOutput3.match(
        /Reading data for package "@proj\/my-pkg-\d*" from my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);

    // It should resolve the current version from the git tag once...
    expect(
      versionOutput3.match(
        new RegExp(
          `Resolved the current version as 1100.0.0 from git tag "xx1100.0.0"`,
          'g'
        )
      ).length
    ).toEqual(1);
    // ...and then reuse it twice
    expect(
      versionOutput3.match(
        new RegExp(
          `Using the current version 1100.0.0 already resolved from git tag "xx1100.0.0"`,
          'g'
        )
      ).length
    ).toEqual(2);

    expect(
      versionOutput3.match(
        /New version 1100.1.0 written to my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);

    // Only one dependency relationship exists, so this log should only match once
    expect(
      versionOutput3.match(
        /Applying new version 1100.1.0 to 1 package which depends on my-pkg-\d*/g
      ).length
    ).toEqual(1);

    createFile(
      `${pkg1}/my-file.txt`,
      'update for conventional-commits testing'
    );

    // Add custom nx release config to control version resolution
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          default: {
            // @proj/source will be added as a project by the verdaccio setup, but we aren't versioning or publishing it, so we exclude it here
            projects: ['*', '!@proj/source'],
            releaseTagPattern: 'xx{version}',
            version: {
              generator: '@nx/js:release-version',
              generatorOptions: {
                specifierSource: 'conventional-commits',
                currentVersionResolver: 'git-tag',
              },
            },
          },
        },
      };
      return nxJson;
    });

    const versionOutput4 = runCLI(`release version`);

    expect(
      versionOutput4.match(/Running release version for project: my-pkg-\d*/g)
        .length
    ).toEqual(3);
    expect(
      versionOutput4.match(
        /Reading data for package "@proj\/my-pkg-\d*" from my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);

    // It should resolve the current version from the git tag once...
    expect(
      versionOutput4.match(
        new RegExp(
          `Resolved the current version as 1100.0.0 from git tag "xx1100.0.0"`,
          'g'
        )
      ).length
    ).toEqual(1);
    // ...and then reuse it twice
    expect(
      versionOutput4.match(
        new RegExp(
          `Using the current version 1100.0.0 already resolved from git tag "xx1100.0.0"`,
          'g'
        )
      ).length
    ).toEqual(2);

    expect(versionOutput4.match(/Skipping versioning/g).length).toEqual(3);

    await runCommandAsync(
      `git add ${pkg1}/my-file.txt && git commit -m "feat!: add new file"`
    );

    const versionOutput5 = runCLI(`release version`);

    expect(
      versionOutput5.match(
        /New version 1101.0.0 written to my-pkg-\d*\/package.json/g
      ).length
    ).toEqual(3);
  }, 500000);
});
