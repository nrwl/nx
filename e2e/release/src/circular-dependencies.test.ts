import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { execSync } from 'node:child_process';
import { resetWorkspaceContext } from 'nx/src/utils/workspace-context';

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
        // Normalize package manager specific logs
        .replaceAll(/p?npm workspaces/g, '{PACKAGE_MANAGER_WORKSPACES}')
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

const originalVerboseLoggingValue = process.env.NX_VERBOSE_LOGGING;

// TODO: Flaky tests
xdescribe('nx release circular dependencies', () => {
  let pkg1: string;
  let pkg2: string;
  let e2eRegistryUrl: string;

  beforeAll(async () => {
    newProject({
      packages: ['@nx/js'],
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${pkg1}`);

    pkg2 = uniq('my-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${pkg2}`);

    // Update pkg1 to be v1 and depend on pkg2
    updateJson(`${pkg1}/package.json`, (json) => {
      json.version = '1.0.0';
      json.dependencies ??= {};
      json.dependencies[`@proj/${pkg2}`] = '1.0.0';
      return json;
    });

    // Update pkg2 to be v1 and depend on pkg1 (via devDependencies)
    updateJson(`${pkg2}/package.json`, (json) => {
      json.version = '1.0.0';
      json.devDependencies ??= {};
      json.devDependencies[`@proj/${pkg1}`] = '1.0.0';
      return json;
    });

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);

    // Force verbose logging for release operations to ensure consistent snapshots
    process.env.NX_VERBOSE_LOGGING = 'true';

    // Ensure that the project graph is accurate (NXC-143)
    runCLI('reset');
    resetWorkspaceContext();
    runCLI('reset');

    // This is the verdaccio instance that the e2e tests themselves are working from
    e2eRegistryUrl = execSync('npm config get registry').toString().trim();
  }, 60000);

  afterAll(() => {
    // Restore original verbose logging value
    process.env.NX_VERBOSE_LOGGING = originalVerboseLoggingValue;
    cleanupProject();
  });

  describe('with fixed release groups and updateDependents never', () => {
    it('should perform a release without any errors or duplication', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projectsRelationship: 'fixed',
          version: {
            updateDependents: 'never',
          },
          changelog: {
            // Enable project level changelogs for all examples
            projectChangelogs: true,
          },
        };
        return nxJson;
      });

      const releaseOutput = runCLI(
        `release major --verbose --first-release -y -d`
      );

      expect(releaseOutput).toMatchInlineSnapshot(`

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 2.0.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "dependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "devDependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        Skipped lock file update because {PACKAGE_MANAGER_WORKSPACES} are not enabled.

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/package.json {project-name}/package.json
        Determined workspace --from ref from the first commit in the workspace: {SHASUM}

        NX   Previewing an entry in CHANGELOG.md for v2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only, there were no code changes.

        Determined release group --from ref from the first commit in the workspace: {SHASUM}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for v2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Previewing an entry in {project-name}/CHANGELOG.md for v2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add CHANGELOG.md {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md

        NX   Committing changes with git

        Would commit all previously staged files in git with the following command, but --dry-run was set:
        git commit --message chore(release): publish 2.0.0

        NX   Tagging commit with git

        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate v2.0.0 --message v2.0.0

        NX   The task graph has a circular dependency

        {project-name}:nx-release-publish --> {project-name}:nx-release-publish --> {project-name}:nx-release-publish


        NX   Running target nx-release-publish for 2 projects:

        - {project-name}
        - {project-name}

        With additional flags:
        --dryRun=true
        --firstRelease=true



        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set

        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for 2 projects



      `);
    });
  });

  describe('with fixed release groups and updateDependents auto', () => {
    it('should perform a release without any errors or duplication', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projectsRelationship: 'fixed',
          version: {
            updateDependents: 'auto',
          },
          changelog: {
            // Enable project level changelogs for all examples
            projectChangelogs: true,
          },
        };
        return nxJson;
      });

      const releaseOutput = runCLI(
        `release major --verbose --first-release -y -d`
      );

      // TODO: Work on a way to remove some of the log noise in the circular dependency case (and in general the multiple updates to the same projects)
      expect(releaseOutput).toMatchInlineSnapshot(`

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied version 2.0.0 directly, because the project is a member of a fixed release group containing {project-name}
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "dependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "devDependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        Skipped lock file update because {PACKAGE_MANAGER_WORKSPACES} are not enabled.

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/package.json {project-name}/package.json
        Determined workspace --from ref from the first commit in the workspace: {SHASUM}

        NX   Previewing an entry in CHANGELOG.md for v2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only, there were no code changes.

        Determined release group --from ref from the first commit in the workspace: {SHASUM}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for v2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Previewing an entry in {project-name}/CHANGELOG.md for v2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add CHANGELOG.md {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md

        NX   Committing changes with git

        Would commit all previously staged files in git with the following command, but --dry-run was set:
        git commit --message chore(release): publish 2.0.0

        NX   Tagging commit with git

        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate v2.0.0 --message v2.0.0

        NX   The task graph has a circular dependency

        {project-name}:nx-release-publish --> {project-name}:nx-release-publish --> {project-name}:nx-release-publish


        NX   Running target nx-release-publish for 2 projects:

        - {project-name}
        - {project-name}

        With additional flags:
        --dryRun=true
        --firstRelease=true



        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set

        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for 2 projects



      `);
    });
  });

  describe('with independent release groups and updateDependents never', () => {
    it('should perform a release of all packages without any errors or duplication', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projectsRelationship: 'independent',
          version: {
            updateDependents: 'never',
          },
          changelog: {
            // Enable project level changelogs for all examples
            projectChangelogs: true,
          },
        };
        return nxJson;
      });

      const releaseOutput = runCLI(
        `release major --verbose --first-release -y -d`
      );

      expect(releaseOutput).toMatchInlineSnapshot(`

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ⏩ Skipping dependent updates as "updateDependents" is not "auto"
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ⏩ Skipping dependent updates as "updateDependents" is not "auto"
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "dependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "devDependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        Skipped lock file update because {PACKAGE_MANAGER_WORKSPACES} are not enabled.

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/package.json {project-name}/package.json
        Determined workspace --from ref from the first commit in the workspace: {SHASUM}
        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + ### 🧱 Updated Dependencies
        +
        + - Updated {project-name} to 2.0.0

        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + ### 🧱 Updated Dependencies
        +
        + - Updated {project-name} to 2.0.0


        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md

        NX   Committing changes with git

        Would commit all previously staged files in git with the following command, but --dry-run was set:
        git commit --message chore(release): publish --message - project: {project-name} 2.0.0 --message - project: {project-name} 2.0.0

        NX   Tagging commit with git

        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate {project-name}@2.0.0 --message {project-name}@2.0.0
        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate {project-name}@2.0.0 --message {project-name}@2.0.0

        NX   The task graph has a circular dependency

        {project-name}:nx-release-publish --> {project-name}:nx-release-publish --> {project-name}:nx-release-publish


        NX   Running target nx-release-publish for 2 projects:

        - {project-name}
        - {project-name}

        With additional flags:
        --dryRun=true
        --firstRelease=true



        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set

        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for 2 projects



      `);
    });

    it('should perform a release of one package without any errors or duplication', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projectsRelationship: 'independent',
          version: {
            updateDependents: 'never',
          },
          changelog: {
            // Enable project level changelogs for all examples
            projectChangelogs: true,
          },
        };
        return nxJson;
      });

      // Only release project 1
      const releaseOutput = runCLI(
        `release major --verbose --first-release -y -d --projects=${pkg1}`
      );

      expect(releaseOutput).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ⏩ Skipping dependent updates as "updateDependents" is not "auto"


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        }
        +


        Skipped lock file update because {PACKAGE_MANAGER_WORKSPACES} are not enabled.

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/package.json
        Determined workspace --from ref from the first commit in the workspace: {SHASUM}
        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.

        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/CHANGELOG.md

        NX   Committing changes with git

        Would commit all previously staged files in git with the following command, but --dry-run was set:
        git commit --message chore(release): publish --message - project: {project-name} 2.0.0

        NX   Tagging commit with git

        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate {project-name}@2.0.0 --message {project-name}@2.0.0

        NX   Running target nx-release-publish for project {project-name}:

        - {project-name}

        With additional flags:
        --dryRun=true
        --firstRelease=true



        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for project {project-name}



      `);
    });
  });

  describe('with independent release groups and updateDependents auto', () => {
    it('should perform a release of all packages without any errors or duplication', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projectsRelationship: 'independent',
          version: {
            updateDependents: 'auto',
          },
          changelog: {
            // Enable project level changelogs for all examples
            projectChangelogs: true,
          },
        };
        return nxJson;
      });

      const releaseOutput = runCLI(
        `release major --verbose --first-release -y -d`
      );

      expect(releaseOutput).toMatchInlineSnapshot(`

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "patch", because a dependency was bumped, to get new version 1.0.1
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "dependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "devDependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        Skipped lock file update because {PACKAGE_MANAGER_WORKSPACES} are not enabled.

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/package.json {project-name}/package.json
        Determined workspace --from ref from the first commit in the workspace: {SHASUM}
        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + ### 🧱 Updated Dependencies
        +
        + - Updated {project-name} to 2.0.0

        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + ### 🧱 Updated Dependencies
        +
        + - Updated {project-name} to 2.0.0


        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md

        NX   Committing changes with git

        Would commit all previously staged files in git with the following command, but --dry-run was set:
        git commit --message chore(release): publish --message - project: {project-name} 2.0.0 --message - project: {project-name} 2.0.0

        NX   Tagging commit with git

        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate {project-name}@2.0.0 --message {project-name}@2.0.0
        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate {project-name}@2.0.0 --message {project-name}@2.0.0

        NX   The task graph has a circular dependency

        {project-name}:nx-release-publish --> {project-name}:nx-release-publish --> {project-name}:nx-release-publish


        NX   Running target nx-release-publish for 2 projects:

        - {project-name}
        - {project-name}

        With additional flags:
        --dryRun=true
        --firstRelease=true



        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set

        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for 2 projects



      `);
    });

    it('should perform a release of one package without any errors or duplication', async () => {
      updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
        nxJson.release = {
          projectsRelationship: 'independent',
          version: {
            updateDependents: 'auto',
          },
          changelog: {
            // Enable project level changelogs for all examples
            projectChangelogs: true,
          },
        };
        return nxJson;
      });

      // Only release project 1
      const releaseOutput = runCLI(
        `release major --verbose --first-release -y -d --projects=${pkg1}`
      );

      expect(releaseOutput).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "major", from the given specifier, to get new version 2.0.0
        {project-name} ✍️  New version 2.0.0 written to manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 📄 Resolved the current version as 1.0.0 from manifest: {project-name}/package.json
        {project-name} ✍️  Updated 1 dependency in manifest: {project-name}/package.json
        {project-name} ❓ Applied semver relative bump "patch", because a dependency was bumped, to get new version 1.0.1
        {project-name} ✍️  New version 1.0.1 written to manifest: {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "2.0.0",
        "scripts": {

        "dependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "1.0.1"
        }
        }
        +


        "name": "@proj/{project-name}",
        -   "version": "1.0.0",
        +   "version": "1.0.1",
        "scripts": {

        "devDependencies": {
        -     "@proj/{project-name}": "1.0.0"
        +     "@proj/{project-name}": "2.0.0"
        }
        }
        +


        Skipped lock file update because {PACKAGE_MANAGER_WORKSPACES} are not enabled.

        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/package.json {project-name}/package.json
        Determined workspace --from ref from the first commit in the workspace: {SHASUM}
        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@2.0.0


        + # 2.0.0 (YYYY-MM-DD)
        +
        + ### 🧱 Updated Dependencies
        +
        + - Updated {project-name} to 1.0.1

        Determined --from ref for {project-name} from the first commit in which it exists: {COMMIT_SHA}

        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@1.0.1


        + ## 1.0.1 (YYYY-MM-DD)
        +
        + ### 🧱 Updated Dependencies
        +
        + - Updated {project-name} to 2.0.0


        NX   Staging changed files with git

        Would stage files in git with the following command, but --dry-run was set:
        git add {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md

        NX   Committing changes with git

        Would commit all previously staged files in git with the following command, but --dry-run was set:
        git commit --message chore(release): publish --message - project: {project-name} 2.0.0

        NX   Tagging commit with git

        Would tag the current commit in git with the following command, but --dry-run was set:
        git tag --annotate {project-name}@2.0.0 --message {project-name}@2.0.0

        NX   Running target nx-release-publish for project {project-name}:

        - {project-name}

        With additional flags:
        --dryRun=true
        --firstRelease=true



        > nx run {project-name}:nx-release-publish

        Skipped npm view because --first-release was set

        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXB  index.js
        XXXB package.json
        XXB  project.json
        === Tarball Details ===
        name:          @proj/{project-name}
        version:       X.X.X-dry-run
        filename:      proj-{project-name}-X.X.X-dry-run.tgz
        package size: XXXB
        unpacked size: XXXB
        shasum:        {SHASUM}
        integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        total files:   3

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for project {project-name}



      `);
    });
  });
});
