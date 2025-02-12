import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  uniq,
} from '@nx/e2e/utils';
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
        .replaceAll(/\d*B  project\.json/g, 'XXB  project.json')
        .replaceAll(/\d*B package\.json/g, 'XXXB package.json')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
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

describe('release publishable libraries in workspace with ts solution setup', () => {
  let e2eRegistryUrl: string;

  beforeAll(async () => {
    newProject({
      packages: ['@nx/js'],
      preset: 'ts',
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
  });
  afterAll(() => cleanupProject());

  it('should be able to release publishable js library', async () => {
    const jsLib = uniq('my-pkg-');
    runCLI(
      `generate @nx/js:lib ${jsLib} --publishable --importPath=@proj/${jsLib}`
    );

    let releaseOutput = runCLI(`release --first-release`);
    expect(releaseOutput).toContain('Executing pre-version command');
    releaseOutput = runCLI(`release --specifier 0.0.2 --yes`);
    expect(releaseOutput).toMatchInlineSnapshot(`
      NX   Executing pre-version command
      NX   Running release version for project: @proj/{project-name}
      @proj/{project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      @proj/{project-name} 📄 Resolved the current version as 0.0.1 from {project-name}/package.json
      @proj/{project-name} 📄 Using the provided version specifier "0.0.2".
      @proj/{project-name} ✍️  New version 0.0.2 written to {project-name}/package.json
      "name": "@proj/{project-name}",
      -   "version": "0.0.1",
      +   "version": "0.0.2",
      "type": "module",
      NX   Updating PM lock file
      NX   Staging changed files with git
      NX   Generating an entry in CHANGELOG.md for v0.0.2
      + ## 0.0.2 (YYYY-MM-DD)
      +
      + This was a version bump only, there were no code changes.
      NX   Staging changed files with git
      NX   Committing changes with git
      NX   Tagging commit with git
      NX   Running target nx-release-publish for project @proj/{project-name}:
      - @proj/{project-name}
      > nx run @proj/{project-name}:nx-release-publish
      📦  @proj/{project-name}@0.0.2
      === Tarball Contents ===
      138B README.md
      76B  dist/index.d.ts
      125B dist/index.d.ts.map
      41B  dist/index.js
      92B  dist/lib/{project-name}.d.ts
      161B dist/lib/{project-name}.d.ts.map
      64B  dist/lib/{project-name}.js
      XXXB package.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       0.0.2
      filename:      proj-{project-name}-0.0.2.tgz
      package size: XXXB
      unpacked size: XXX.XXX kb
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   8
      Published to ${e2eRegistryUrl} with tag "latest"
      NX   Successfully ran target nx-release-publish for project @proj/{project-name}
    `);
  });
});
