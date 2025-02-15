import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  tmpProjPath,
  uniq,
} from '@nx/e2e/utils';
import { emptydirSync } from 'fs-extra';
import { execSync } from 'node:child_process';

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
        .replaceAll(/\d*B\s+project\.json/g, 'XXB project.json')
        .replaceAll(/\d*B\s+package\.json/g, 'XXXB package.json')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
        .replaceAll(/\d*B\s+src\//g, 'XXB src/')
        .replaceAll(/\d*B\s+index/g, 'XXB index')
        .replaceAll(/total files:\s+\d*/g, 'total files: X')
        .replaceAll(/\d*B\s+README.md/g, 'XXB README.md')
        .replaceAll(/[a-fA-F0-9]{7}/g, '{COMMIT_SHA}')
        .replaceAll(/Test @[\w\d]+/g, 'Test @{COMMIT_AUTHOR}')
        .replaceAll(/(\w+) lock file/g, 'PM lock file')
        // Normalize the version title date.
        .replaceAll(/\(\d{4}-\d{2}-\d{2}\)/g, '(YYYY-MM-DD)')
        // We trim each line to reduce the chances of snapshot flakiness
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
        .join('\n')
    );
  },
  test(val: string) {
    return val != null && typeof val === 'string';
  },
});

describe('release publishable libraries', () => {
  let e2eRegistryUrl: string;

  beforeAll(async () => {
    newProject({
      packages: ['@nx/js', '@nx/react'],
    });

    // Normalize git committer information so it is deterministic in snapshots
    await runCommandAsync(`git config user.email "test@test.com"`);
    await runCommandAsync(`git config user.name "Test"`);
    // Create a baseline version tag
    await runCommandAsync(`git tag v0.0.0`);

    // We need a valid git origin to exist for the commit references to work (and later the test for createRelease)
    await runCommandAsync(
      `git remote add origin https://github.com/nrwl/fake-repo.git`
    );

    // This is the verdaccio instance that the e2e tests themselves are working from
    e2eRegistryUrl = execSync('npm config get registry').toString().trim();
  }, 60000);

  beforeEach(() => {
    try {
      emptydirSync(tmpProjPath('packages'));
    } catch (e) {}
  });

  afterAll(() => cleanupProject());

  it('should be able to release publishable js library', async () => {
    const jsLib = uniq('my-pkg-');
    runCLI(
      `generate @nx/js:lib packages/${jsLib} --publishable --importPath=@proj/${jsLib} --no-interactive`
    );

    const releaseOutput = runCLI(`release --specifier 0.0.2 --yes`);
    expect(releaseOutput).toMatchInlineSnapshot(`
      NX   Executing pre-version command
      NX   Running release version for project: {project-name}
      {project-name} 🔍 Reading data for package "@proj/{project-name}" from dist/packages/{project-name}/package.json
      {project-name} 📄 Resolved the current version as 0.0.0 from git tag "v0.0.0".
      {project-name} 📄 Using the provided version specifier "0.0.2".
      {project-name} ✍️  New version 0.0.2 written to dist/packages/{project-name}/package.json
      "name": "@proj/{project-name}",
      -   "version": "0.0.1",
      +   "version": "0.0.2",
      "type": "commonjs",
      }
      +
      NX   Staging changed files with git
      No files to stage. Skipping git add.
      NX   Generating an entry in CHANGELOG.md for v0.0.2
      + ## 0.0.2 (YYYY-MM-DD)
      +
      + This was a version bump only, there were no code changes.
      NX   Staging changed files with git
      NX   Committing changes with git
      NX   Tagging commit with git
      NX   Running target nx-release-publish for project {project-name}:
      - {project-name}
      > nx run {project-name}:nx-release-publish
      📦  @proj/{project-name}@0.0.2
      === Tarball Contents ===
      XXB README.md
      XXXB package.json
      XXB src/index.d.ts
      XXB src/index.js
      XXB src/index.js.map
      XXB src/lib/{project-name}.d.ts
      XXB src/lib/{project-name}.js
      XXB src/lib/{project-name}.js.map
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       0.0.2
      filename:      proj-{project-name}-0.0.2.tgz
      package size: XXXB
      unpacked size: XXX.XXX kb
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files: X
      Published to ${e2eRegistryUrl} with tag "latest"
      NX   Successfully ran target nx-release-publish for project {project-name}
    `);
  });

  it('should be able to release publishable react library', async () => {
    const reactLib = uniq('my-pkg-');
    runCLI(
      `generate @nx/react:lib packages/${reactLib} --publishable --importPath=@proj/${reactLib} --no-interactive`
    );

    const releaseOutput = runCLI(`release --specifier 0.0.3 --yes`);
    expect(releaseOutput).toMatchInlineSnapshot(`
      NX   Executing pre-version command
      NX   Running release version for project: {project-name}
      {project-name} 🔍 Reading data for package "@proj/{project-name}" from dist/packages/{project-name}/package.json
      {project-name} 📄 Resolved the current version as 0.0.2 from git tag "v0.0.2".
      {project-name} 📄 Using the provided version specifier "0.0.3".
      {project-name} ✍️  New version 0.0.3 written to dist/packages/{project-name}/package.json
      "name": "@proj/{project-name}",
      -   "version": "0.0.1",
      +   "version": "0.0.3",
      "module": "./index.esm.js",
      }
      +
      NX   Staging changed files with git
      No files to stage. Skipping git add.
      NX   Generating an entry in CHANGELOG.md for v0.0.3
      + ## 0.0.3 (YYYY-MM-DD)
      +
      + This was a version bump only, there were no code changes.
      +
      ## 0.0.2 (YYYY-MM-DD)
      This was a version bump only, there were no code changes.
      NX   Staging changed files with git
      NX   Committing changes with git
      NX   Tagging commit with git
      NX   Running target nx-release-publish for project {project-name}:
      - {project-name}
      > nx run {project-name}:nx-release-publish
      📦  @proj/{project-name}@0.0.3
      === Tarball Contents ===
      XXX.XXX kb README.md
      XXB index.esm.css
      XXB index.esm.d.ts
      XXB index.esm.js
      XXXB package.json
      XXB src/index.d.ts
      XXB src/lib/{project-name}.d.ts
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       0.0.3
      filename:      proj-{project-name}-0.0.3.tgz
      package size:  XXX.XXX kb
      unpacked size: XXX.XXX kb
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files: X
      Published to ${e2eRegistryUrl} with tag "latest"
      NX   Successfully ran target nx-release-publish for project {project-name}
    `);
  });
});
