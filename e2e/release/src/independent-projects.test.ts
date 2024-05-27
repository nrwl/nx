import { joinPathFragments } from '@nx/devkit';
import {
  cleanupProject,
  exists,
  getSelectedPackageManager,
  newProject,
  readFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';

expect.addSnapshotSerializer({
  serialize(str: string) {
    return (
      str
        // Remove all output unique to specific projects to ensure deterministic snapshots
        .replaceAll(`/private/${tmpProjPath()}`, '')
        .replaceAll(tmpProjPath(), '')
        .replaceAll('/private/', '')
        .replaceAll(/my-pkg-\d+/g, '{project-name}')
        .replaceAll(' in /{project-name}', ' in {project-name}')
        .replaceAll(
          /integrity:\s*.*/g,
          'integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        )
        .replaceAll(/\b[0-9a-f]{40}\b/g, '{SHASUM}')
        .replaceAll(/\d*B  index\.js/g, 'XXB  index.js')
        .replaceAll(/\d*B  project\.json/g, 'XXB  project.json')
        .replaceAll(/\d*B package\.json/g, 'XXXB package.json')
        .replaceAll(/\d*B CHANGELOG\.md/g, 'XXXB CHANGELOG.md')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
        // Normalize the version title date
        .replaceAll(/\(\d{4}-\d{2}-\d{2}\)/g, '(YYYY-MM-DD)')
        .replaceAll('package-lock.json', '{lock-file}')
        .replaceAll('yarn.lock', '{lock-file}')
        .replaceAll('pnpm-lock.yaml', '{lock-file}')
        .replaceAll('npm install --package-lock-only', '{lock-file-command}')
        .replaceAll(
          'yarn install --mode update-lockfile',
          '{lock-file-command}'
        )
        .replaceAll('pnpm install --lockfile-only', '{lock-file-command}')
        .replaceAll(getSelectedPackageManager(), '{package-manager}')
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

describe('nx release - independent projects', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let e2eRegistryUrl: string;

  beforeAll(() => {
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

    /**
     * Update pkg2 to depend on pkg3.
     */
    updateJson(`${pkg2}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${pkg3}`] = '0.0.0';
      return json;
    });

    // Normalize git committer information so it is deterministic in snapshots
    runCommand(`git config user.email "test@test.com"`);
    runCommand(`git config user.name "Test"`);
    // Create a baseline version tag for each project
    runCommand(`git tag ${pkg1}@0.0.0`);
    runCommand(`git tag ${pkg2}@0.0.0`);
    runCommand(`git tag ${pkg3}@0.0.0`);

    // This is the verdaccio instance that the e2e tests themselves are working from
    e2eRegistryUrl = execSync('npm config get registry').toString().trim();
  });
  afterAll(() => cleanupProject());

  describe('version', () => {
    beforeEach(() => {
      /**
       * Configure independent releases in the most minimal way possible.
       */
      updateJson('nx.json', () => {
        return {
          release: {
            projectsRelationship: 'independent',
          },
        };
      });
    });

    it('should allow versioning projects independently', async () => {
      const versionPkg1Output = runCLI(
        `release version 999.9.9-package.1 -p ${pkg1}`
      );
      expect(versionPkg1Output).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 0.0.0 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-package.1".
        {project-name} ✍️  New version 999.9.9-package.1 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "0.0.0",
        +   "version": "999.9.9-package.1",
        "scripts": {


        NX   Staging changed files with git


      `);

      const versionPkg2Output = runCLI(
        `release version 999.9.9-package.2 -p ${pkg2}`
      );
      expect(versionPkg2Output).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 0.0.0 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-package.2".
        {project-name} ✍️  New version 999.9.9-package.2 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "0.0.0",
        +   "version": "999.9.9-package.2",
        "scripts": {

        }
        +


        NX   Staging changed files with git


      `);

      const versionPkg3Output = runCLI(
        `release version 999.9.9-package.3 -p ${pkg3}`
      );
      expect(versionPkg3Output).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 0.0.0 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-package.3".
        {project-name} ⚠️  Warning, the following packages depend on "{project-name}" but have been filtered out via --projects, and therefore will not be updated:
        - {project-name}
        => You can adjust this behavior by setting \`version.generatorOptions.updateDependents\` to "auto"
        {project-name} ✍️  New version 999.9.9-package.3 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "0.0.0",
        +   "version": "999.9.9-package.3",
        "scripts": {


        NX   Staging changed files with git


      `);
    }, 500000);

    it('should support automated git operations after versioning when configured', async () => {
      const headSHA = runCommand(`git rev-parse HEAD`).trim();
      runCLI(
        `release version 999.9.9-version-git-operations-test.1 -p ${pkg1}`
      );
      // No git operations should have been performed by the previous command because not yet configured in nx.json nor passed as a flag
      expect(runCommand(`git rev-parse HEAD`).trim()).toEqual(headSHA);

      // Enable git commit and tag operations via CLI flags
      const versionWithGitActionsCLIOutput = runCLI(
        `release version 999.9.9-version-git-operations-test.2 -p ${pkg1} --git-commit --git-tag --verbose` // add verbose so we get richer output
      );
      expect(versionWithGitActionsCLIOutput).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-version-git-operations-test.1 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.2".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.2 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "999.9.9-version-git-operations-test.1",
        +   "version": "999.9.9-version-git-operations-test.2",
        "scripts": {


        Skipped lock file update because {package-manager} workspaces are not enabled.

        NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/package.json

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-version-git-operations-test.2

        NX   Tagging commit with git

        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-version-git-operations-test.2 --message {project-name}@999.9.9-version-git-operations-test.2

      `);

      // Ensure the git operations were performed
      expect(runCommand(`git rev-parse HEAD`).trim()).not.toEqual(headSHA);
      // Commit
      expect(runCommand(`git --no-pager log -1 --pretty=format:%B`).trim())
        .toMatchInlineSnapshot(`
        chore(release): publish

        - project: {project-name} 999.9.9-version-git-operations-test.2
      `);
      // Tags
      expect(runCommand('git tag --points-at HEAD')).toMatchInlineSnapshot(`
        {project-name}@999.9.9-version-git-operations-test.2

      `);

      // Enable git commit and tag operations for the version command via config
      updateJson('nx.json', (json) => {
        return {
          ...json,
          release: {
            ...json.release,
            version: {
              ...json.release.version,
              git: {
                commit: true,
                tag: true,
              },
            },
            // Configure multiple release groups with different relationships to capture differences in commit body
            groups: {
              independent: {
                projects: [pkg1, pkg2],
                projectsRelationship: 'independent',
              },
              fixed: {
                projects: [pkg3],
                projectsRelationship: 'fixed',
              },
            },
          },
        };
      });

      const versionWithGitActionsConfigOutput = runCLI(
        `release version 999.9.9-version-git-operations-test.3 --verbose` // add verbose so we get richer output
      );
      expect(versionWithGitActionsConfigOutput).toMatchInlineSnapshot(`

        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-version-git-operations-test.2 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.3".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.3 written to {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-package.2 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.3".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.3 written to {project-name}/package.json

        NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-package.3 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.3".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.3 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "999.9.9-version-git-operations-test.2",
        +   "version": "999.9.9-version-git-operations-test.3",
        "scripts": {


        "name": "@proj/{project-name}",
        -   "version": "999.9.9-package.2",
        +   "version": "999.9.9-version-git-operations-test.3",
        "scripts": {


        "name": "@proj/{project-name}",
        -   "version": "999.9.9-package.3",
        +   "version": "999.9.9-version-git-operations-test.3",
        "scripts": {


        Skipped lock file update because {package-manager} workspaces are not enabled.

        Skipped lock file update because {package-manager} workspaces are not enabled.

        NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/package.json {project-name}/package.json {project-name}/package.json

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-version-git-operations-test.3 --message - project: {project-name} 999.9.9-version-git-operations-test.3 --message - release-group: fixed 999.9.9-version-git-operations-test.3

        NX   Tagging commit with git

        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-version-git-operations-test.3 --message {project-name}@999.9.9-version-git-operations-test.3
        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-version-git-operations-test.3 --message {project-name}@999.9.9-version-git-operations-test.3
        Tagging the current commit in git with the following command:
        git tag --annotate v999.9.9-version-git-operations-test.3 --message v999.9.9-version-git-operations-test.3

      `);

      // Ensure the git operations were performed
      expect(runCommand(`git rev-parse HEAD`).trim()).not.toEqual(headSHA);
      // Commit
      expect(runCommand(`git --no-pager log -1 --pretty=format:%B`).trim())
        .toMatchInlineSnapshot(`
        chore(release): publish

        - project: {project-name} 999.9.9-version-git-operations-test.3

        - project: {project-name} 999.9.9-version-git-operations-test.3

        - release-group: fixed 999.9.9-version-git-operations-test.3
      `);
      // Tags
      expect(runCommand('git tag --points-at HEAD')).toMatchInlineSnapshot(`
        {project-name}@999.9.9-version-git-operations-test.3
        {project-name}@999.9.9-version-git-operations-test.3
        v999.9.9-version-git-operations-test.3

      `);
    });
  });

  describe('changelog', () => {
    beforeEach(() => {
      updateJson('nx.json', () => {
        return {
          release: {
            projectsRelationship: 'independent',
            changelog: {
              projectChangelogs: true, // enable project changelogs with default options
              workspaceChangelog: false, // disable workspace changelog
            },
          },
        };
      });
    });

    it('should allow generating changelogs for projects independently', async () => {
      // pkg1
      const changelogPkg1Output = runCLI(
        `release changelog 999.9.9-package.1 -p ${pkg1} --dry-run`
      );
      expect(changelogPkg1Output).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-package.1


        + ## 999.9.9-package.1 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Committing changes with git


        NX   Tagging commit with git


      `);

      // pkg2
      const changelogPkg2Output = runCLI(
        `release changelog 999.9.9-package.2 -p ${pkg2} --dry-run`
      );
      expect(changelogPkg2Output).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-package.2


        + ## 999.9.9-package.2 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Committing changes with git


        NX   Tagging commit with git


      `);

      // pkg3
      const changelogPkg3Output = runCLI(
        `release changelog 999.9.9-package.3 -p ${pkg3} --dry-run`
      );
      expect(changelogPkg3Output).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-package.3


        + ## 999.9.9-package.3 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Committing changes with git


        NX   Tagging commit with git


      `);
    }, 500000);

    it('should support automated git operations after changelog by default', async () => {
      // No project changelog yet
      expect(exists(joinPathFragments(pkg1, 'CHANGELOG.md'))).toEqual(false);

      const headSHA = runCommand(`git rev-parse HEAD`).trim();

      const versionWithGitActionsCLIOutput = runCLI(
        `release changelog 999.9.9-changelog-git-operations-test.1 -p ${pkg1} --verbose`
      );
      expect(versionWithGitActionsCLIOutput).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        NX   Generating an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-changelog-git-operations-test.1


        + ## 999.9.9-changelog-git-operations-test.1 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/CHANGELOG.md

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-changelog-git-operations-test.1

        NX   Tagging commit with git

        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-changelog-git-operations-test.1 --message {project-name}@999.9.9-changelog-git-operations-test.1

      `);

      // Ensure the git operations were performed
      expect(runCommand(`git rev-parse HEAD`).trim()).not.toEqual(headSHA);
      // Commit
      expect(runCommand(`git --no-pager log -1 --pretty=format:%B`).trim())
        .toMatchInlineSnapshot(`
        chore(release): publish

        - project: {project-name} 999.9.9-changelog-git-operations-test.1
      `);
      // Tags
      expect(runCommand('git tag --points-at HEAD')).toMatchInlineSnapshot(`
        {project-name}@999.9.9-changelog-git-operations-test.1

      `);

      expect(readFile(joinPathFragments(pkg1, 'CHANGELOG.md')))
        .toMatchInlineSnapshot(`
        ## 999.9.9-changelog-git-operations-test.1 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.
      `);

      const updatedHeadSHA = runCommand(`git rev-parse HEAD`).trim();
      // Disable git commit and tag operations via CLI flags
      runCLI(
        `release changelog 999.9.9-changelog-git-operations-test.2 -p ${pkg1} --git-commit=false --git-tag=false --verbose` // add verbose so we get richer output
      );
      // No git operations should have been performed by the previous command
      expect(runCommand(`git rev-parse HEAD`).trim()).toEqual(updatedHeadSHA);

      // Disable git commit and tag operations for the changelog command via config
      updateJson('nx.json', (json) => {
        return {
          ...json,
          release: {
            ...json.release,
            changelog: {
              ...json.release.changelog,
              git: {
                commit: false,
                tag: false,
              },
            },
            // Configure multiple release groups with different relationships to capture differences in commit body
            groups: {
              independent: {
                projects: [pkg1, pkg2],
                projectsRelationship: 'independent',
              },
              fixed: {
                projects: [pkg3],
                projectsRelationship: 'fixed',
              },
            },
          },
        };
      });

      runCLI(
        `release changelog 999.9.9-changelog-git-operations-test.3 --verbose` // add verbose so we get richer output
      );

      // Ensure no git operations were performed
      expect(runCommand(`git rev-parse HEAD`).trim()).toEqual(updatedHeadSHA);
    });
  });

  describe('publish', () => {
    beforeEach(() => {
      updateJson('nx.json', () => {
        return {
          release: {
            projectsRelationship: 'independent',
            groups: {
              group1: {
                projects: [pkg1, pkg2],
              },
              group2: {
                projects: [pkg3],
              },
            },
          },
        };
      });
    });

    it('should only run the publish task for the filtered projects', async () => {
      // Should only contain 1 project
      expect(runCLI(`release publish -p ${pkg1} -d`)).toMatchInlineSnapshot(`

        NX   Your filter "{project-name}" matched the following projects:

        - {project-name} (release group "group1")


        NX   Running target nx-release-publish for project {project-name}:

        - {project-name}

        With additional flags:
        --dryRun=true



        > nx run {project-name}:nx-release-publish


        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXXB CHANGELOG.md
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
        total files:   4

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for project {project-name}



      `);

      // Should only contain 2 projects
      expect(runCLI(`release publish -p ${pkg1} -p ${pkg3} -d`))
        .toMatchInlineSnapshot(`

        NX   Your filter "{project-name},{project-name}" matched the following projects:

        - {project-name} (release group "group1")
        - {project-name} (release group "group2")


        NX   Running target nx-release-publish for project {project-name}:

        - {project-name}

        With additional flags:
        --dryRun=true



        > nx run {project-name}:nx-release-publish


        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXXB CHANGELOG.md
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
        total files:   4

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for project {project-name}



        NX   Running target nx-release-publish for project {project-name}:

        - {project-name}

        With additional flags:
        --dryRun=true



        > nx run {project-name}:nx-release-publish


        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXXB CHANGELOG.md
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
        total files:   4

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for project {project-name}



      `);
    });

    it('should only run the publish task for the filtered projects', async () => {
      // Should only contain the 2 projects from group1
      expect(runCLI(`release publish -g group1 -d`)).toMatchInlineSnapshot(`

        NX   Running target nx-release-publish for 2 projects:

        - {project-name}
        - {project-name}

        With additional flags:
        --dryRun=true



        > nx run {project-name}:nx-release-publish


        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXXB CHANGELOG.md
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
        total files:   4

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set

        > nx run {project-name}:nx-release-publish


        📦  @proj/{project-name}@X.X.X-dry-run
        === Tarball Contents ===

        XXXB CHANGELOG.md
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
        total files:   4

        Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



        NX   Successfully ran target nx-release-publish for 2 projects



      `);

      // Should only contain the 1 project from group2
      expect(runCLI(`release publish -g group2 -d`)).toMatchInlineSnapshot(`

          NX   Running target nx-release-publish for project {project-name}:

          - {project-name}

          With additional flags:
          --dryRun=true



          > nx run {project-name}:nx-release-publish


          📦  @proj/{project-name}@X.X.X-dry-run
          === Tarball Contents ===

          XXXB CHANGELOG.md
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
          total files:   4

          Would publish to ${e2eRegistryUrl} with tag "latest", but [dry-run] was set



          NX   Successfully ran target nx-release-publish for project {project-name}



      `);
    });
  });

  describe('release command', () => {
    it('should allow versioning projects independently', async () => {
      updateJson('nx.json', () => {
        return {
          release: {
            projectsRelationship: 'independent',
            releaseTagPattern: '{projectName}@v{version}',
            version: {
              generatorOptions: {
                currentVersionResolver: 'git-tag',
              },
            },
            changelog: {
              projectChangelogs: true,
            },
          },
        };
      });

      runCommand(`git add .`);
      runCommand(`git commit -m "chore: initial commit"`);

      runCommand(`git tag ${pkg1}@v1.2.0`);
      runCommand(`git tag ${pkg2}@v1.4.0`);
      runCommand(`git tag ${pkg3}@v1.6.0`);

      const releaseOutput = runCLI(`release patch -y`);

      expect(
        releaseOutput.match(new RegExp(`New version 1\.2\.1 written`, 'g'))
          .length
      ).toEqual(1);

      expect(
        releaseOutput.match(new RegExp(`New version 1\.4\.1 written`, 'g'))
          .length
      ).toEqual(1);

      expect(
        releaseOutput.match(new RegExp(`New version 1\.6\.1 written`, 'g'))
          .length
      ).toEqual(1);

      expect(
        releaseOutput.match(new RegExp(`Generating an entry in `, 'g')).length
      ).toEqual(3);

      expect(
        releaseOutput.match(
          new RegExp(
            `Successfully ran target nx-release-publish for 3 projects`,
            'g'
          )
        ).length
      ).toEqual(1);
    });

    it('should allow versioning projects independently with conventional commits', async () => {
      updateJson('nx.json', () => {
        return {
          release: {
            projectsRelationship: 'independent',
            releaseTagPattern: '{projectName}@v{version}',
            version: {
              generatorOptions: {
                // added specifierSource to ensure conventional commits are used
                specifierSource: 'conventional-commits',
                currentVersionResolver: 'git-tag',
              },
            },
            changelog: {
              projectChangelogs: true,
            },
          },
        };
      });

      runCommand(`git add .`);
      runCommand(`git commit -m "chore: initial commit"`);

      runCommand(`git tag ${pkg1}@v1.3.0`);
      runCommand(`git tag ${pkg2}@v1.5.0`);
      runCommand(`git tag ${pkg3}@v1.7.0`);

      // update my-pkg-1 with a feature commit
      updateJson(`${pkg1}/package.json`, (json) => ({
        ...json,
        license: 'MIT',
      }));
      runCommand(`git add ${pkg1}/package.json`);
      runCommand(`git commit -m "feat(${pkg1}): new feature 1"`);

      // update my-pkg-3 with a feature commit
      updateJson(`${pkg3}/package.json`, (json) => ({
        ...json,
        license: 'GNU GPLv3',
      }));
      runCommand(`git add ${pkg3}/package.json`);
      runCommand(`git commit -m "feat(${pkg3}): new feat 3"`);

      // set 1.8.0 as the current version for package 3
      runCommand(`git tag ${pkg3}@v1.8.0`);

      // update my-pkg-3 with a fix commit
      updateJson(`${pkg3}/package.json`, (json) => ({
        ...json,
        license: 'MIT',
      }));
      runCommand(`git add ${pkg3}/package.json`);
      runCommand(`git commit -m "fix(${pkg3}): new fix 3"`);

      const releaseOutput = runCLI(`release -y`);

      expect(
        releaseOutput.match(
          new RegExp(
            `Resolved the specifier as "minor" using git history and the conventional commits standard.`,
            'g'
          )
        ).length
      ).toEqual(1);
      expect(
        releaseOutput.match(
          new RegExp(`New version 1\\.4\\.0 written to my-pkg-1\\d*`, 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput.match(
          new RegExp(`- \\*\\*${pkg1}:\\*\\* new feature 1`, 'g')
        ).length
      ).toEqual(1);

      expect(
        releaseOutput.match(
          new RegExp(
            `Resolved the specifier as "patch" using git history and the conventional commits standard.`,
            'g'
          )
        ).length
      ).toEqual(1);
      expect(
        releaseOutput.match(
          new RegExp(`New version 1\\.8\\.1 written to my-pkg-3\\d*`, 'g')
        ).length
      ).toEqual(1);
      expect(
        releaseOutput.match(new RegExp(`- \\*\\*${pkg3}:\\*\\* new fix 3`, 'g'))
          .length
      ).toEqual(1);

      expect(
        releaseOutput.match(new RegExp(`Generating an entry in `, 'g')).length
      ).toEqual(2);

      expect(
        releaseOutput.match(
          new RegExp(
            `Successfully ran target nx-release-publish for 3 projects`,
            'g'
          )
        ).length
      ).toEqual(1);
    });
  });
});
