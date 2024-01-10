import { joinPathFragments } from '@nx/devkit';
import {
  cleanupProject,
  exists,
  newProject,
  readFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e/utils';

expect.addSnapshotSerializer({
  serialize(str: string) {
    return (
      str
        // Remove all output unique to specific projects to ensure deterministic snapshots
        .replaceAll(`/private/${tmpProjPath()}`, '')
        .replaceAll(tmpProjPath(), '')
        .replaceAll('/private/', '')
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
        // Normalize the version title date
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

describe('nx release - independent projects', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

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
    updateJson(`${pkg3}/package.json`, (json) => {
      json.private = true;
      return json;
    });

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

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 0.0.0 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-package.1".
        {project-name} ✍️  New version 999.9.9-package.1 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "0.0.0",
        +   "version": "999.9.9-package.1",
        "scripts": {


      `);

      const versionPkg2Output = runCLI(
        `release version 999.9.9-package.2 -p ${pkg2}`
      );
      expect(versionPkg2Output).toMatchInlineSnapshot(`

          >  NX   Your filter "{project-name}" matched the following projects:

          - {project-name}


          >  NX   Running release version for project: {project-name}

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


      `);

      const versionPkg3Output = runCLI(
        `release version 999.9.9-package.3 -p ${pkg3}`
      );
      expect(versionPkg3Output).toMatchInlineSnapshot(`

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 0.0.0 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-package.3".
        {project-name} ✍️  New version 999.9.9-package.3 written to {project-name}/package.json
        {project-name} ✍️  Applying new version 999.9.9-package.3 to 1 package which depends on {project-name}


        "name": "@proj/{project-name}",
        -   "version": "0.0.0",
        +   "version": "999.9.9-package.3",
        "scripts": {

        }
        +


        "dependencies": {
        -     "@proj/{project-name}": "0.0.0"
        +     "@proj/{project-name}": "999.9.9-package.3"
        }


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

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-version-git-operations-test.1 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.2".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.2 written to {project-name}/package.json


        "name": "@proj/{project-name}",
        -   "version": "999.9.9-version-git-operations-test.1",
        +   "version": "999.9.9-version-git-operations-test.2",
        "scripts": {


        >  NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/package.json

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-version-git-operations-test.2

        >  NX   Tagging commit with git

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

        >  NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-version-git-operations-test.2 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.3".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.3 written to {project-name}/package.json

        >  NX   Running release version for project: {project-name}

        {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
        {project-name} 📄 Resolved the current version as 999.9.9-package.2 from {project-name}/package.json
        {project-name} 📄 Using the provided version specifier "999.9.9-version-git-operations-test.3".
        {project-name} ✍️  New version 999.9.9-version-git-operations-test.3 written to {project-name}/package.json

        >  NX   Running release version for project: {project-name}

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


        >  NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/package.json {project-name}/package.json {project-name}/package.json

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-version-git-operations-test.3 --message - project: {project-name} 999.9.9-version-git-operations-test.3 --message - release-group: fixed 999.9.9-version-git-operations-test.3

        >  NX   Tagging commit with git

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
              projectChangelogs: {}, // enable project changelogs with default options
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

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-package.1


        + ## 999.9.9-package.1 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


      `);

      // pkg2
      const changelogPkg2Output = runCLI(
        `release changelog 999.9.9-package.2 -p ${pkg2} --dry-run`
      );
      expect(changelogPkg2Output).toMatchInlineSnapshot(`

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-package.2


        + ## 999.9.9-package.2 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


      `);

      // pkg3
      const changelogPkg3Output = runCLI(
        `release changelog 999.9.9-package.3 -p ${pkg3} --dry-run`
      );
      expect(changelogPkg3Output).toMatchInlineSnapshot(`

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Previewing an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-package.3


        + ## 999.9.9-package.3 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


      `);
    }, 500000);

    it('should support automated git operations after changelog when configured', async () => {
      // No project changelog yet
      expect(exists(joinPathFragments(pkg1, 'CHANGELOG.md'))).toEqual(false);

      const headSHA = runCommand(`git rev-parse HEAD`).trim();
      runCLI(
        `release changelog 999.9.9-changelog-git-operations-test.1 -p ${pkg1}`
      );
      // No git operations should have been performed by the previous command because not yet configured in nx.json nor passed as a flag
      expect(runCommand(`git rev-parse HEAD`).trim()).toEqual(headSHA);

      expect(readFile(joinPathFragments(pkg1, 'CHANGELOG.md')))
        .toMatchInlineSnapshot(`
        ## 999.9.9-changelog-git-operations-test.1 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.
      `);

      // Enable git commit and tag operations via CLI flags
      const versionWithGitActionsCLIOutput = runCLI(
        `release changelog 999.9.9-changelog-git-operations-test.2 -p ${pkg1} --git-commit --git-tag --verbose` // add verbose so we get richer output
      );
      expect(versionWithGitActionsCLIOutput).toMatchInlineSnapshot(`

        >  NX   Your filter "{project-name}" matched the following projects:

        - {project-name}


        >  NX   Generating an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-changelog-git-operations-test.2


        + ## 999.9.9-changelog-git-operations-test.2 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.
        +
        ## 999.9.9-changelog-git-operations-test.1 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        >  NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/CHANGELOG.md

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-changelog-git-operations-test.2

        >  NX   Tagging commit with git

        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-changelog-git-operations-test.2 --message {project-name}@999.9.9-changelog-git-operations-test.2

      `);

      // Ensure the git operations were performed
      expect(runCommand(`git rev-parse HEAD`).trim()).not.toEqual(headSHA);
      // Commit
      expect(runCommand(`git --no-pager log -1 --pretty=format:%B`).trim())
        .toMatchInlineSnapshot(`
        chore(release): publish

        - project: {project-name} 999.9.9-changelog-git-operations-test.2
      `);
      // Tags
      expect(runCommand('git tag --points-at HEAD')).toMatchInlineSnapshot(`
        {project-name}@999.9.9-changelog-git-operations-test.2

      `);

      expect(readFile(joinPathFragments(pkg1, 'CHANGELOG.md')))
        .toMatchInlineSnapshot(`
        ## 999.9.9-changelog-git-operations-test.2 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.

        ## 999.9.9-changelog-git-operations-test.1 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.
      `);

      // Enable git commit and tag operations for the changelog command via config
      updateJson('nx.json', (json) => {
        return {
          ...json,
          release: {
            ...json.release,
            changelog: {
              ...json.release.changelog,
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
        `release changelog 999.9.9-changelog-git-operations-test.3 --verbose` // add verbose so we get richer output
      );
      expect(versionWithGitActionsConfigOutput).toMatchInlineSnapshot(`

        >  NX   Generating an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-changelog-git-operations-test.3



        + ## 999.9.9-changelog-git-operations-test.3 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.
        +
        ## 999.9.9-changelog-git-operations-test.2 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        >  NX   Generating an entry in {project-name}/CHANGELOG.md for {project-name}@999.9.9-changelog-git-operations-test.3


        + ## 999.9.9-changelog-git-operations-test.3 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        >  NX   Generating an entry in {project-name}/CHANGELOG.md for v999.9.9-changelog-git-operations-test.3


        + ## 999.9.9-changelog-git-operations-test.3 (YYYY-MM-DD)
        +
        + This was a version bump only for {project-name} to align it with other projects, there were no code changes.


        >  NX   Committing changes with git

        Staging files in git with the following command:
        git add {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md {project-name}/CHANGELOG.md

        Committing files in git with the following command:
        git commit --message chore(release): publish --message - project: {project-name} 999.9.9-changelog-git-operations-test.3 --message - project: {project-name} 999.9.9-changelog-git-operations-test.3 --message - release-group: fixed 999.9.9-changelog-git-operations-test.3

        >  NX   Tagging commit with git

        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-changelog-git-operations-test.3 --message {project-name}@999.9.9-changelog-git-operations-test.3
        Tagging the current commit in git with the following command:
        git tag --annotate {project-name}@999.9.9-changelog-git-operations-test.3 --message {project-name}@999.9.9-changelog-git-operations-test.3
        Tagging the current commit in git with the following command:
        git tag --annotate v999.9.9-changelog-git-operations-test.3 --message v999.9.9-changelog-git-operations-test.3

      `);

      // Ensure the git operations were performed
      expect(runCommand(`git rev-parse HEAD`).trim()).not.toEqual(headSHA);
      // Commit
      expect(runCommand(`git --no-pager log -1 --pretty=format:%B`).trim())
        .toMatchInlineSnapshot(`
        chore(release): publish

        - project: {project-name} 999.9.9-changelog-git-operations-test.3

        - project: {project-name} 999.9.9-changelog-git-operations-test.3

        - release-group: fixed 999.9.9-changelog-git-operations-test.3
      `);
      // Tags
      expect(runCommand('git tag --points-at HEAD')).toMatchInlineSnapshot(`
        {project-name}@999.9.9-changelog-git-operations-test.3
        {project-name}@999.9.9-changelog-git-operations-test.3
        v999.9.9-changelog-git-operations-test.3

      `);

      expect(readFile(joinPathFragments(pkg1, 'CHANGELOG.md')))
        .toMatchInlineSnapshot(`
        ## 999.9.9-changelog-git-operations-test.3 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.

        ## 999.9.9-changelog-git-operations-test.2 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.

        ## 999.9.9-changelog-git-operations-test.1 (YYYY-MM-DD)

        This was a version bump only for {project-name} to align it with other projects, there were no code changes.
      `);
    });
  });

  describe('release command', () => {
    beforeEach(() => {
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
              projectChangelogs: {},
            },
          },
        };
      });
    });

    it('should allow versioning projects independently', async () => {
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
              projectChangelogs: {},
            },
          },
        };
      });

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
