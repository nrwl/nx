import {
  cleanupProject,
  newProject,
  runCLI,
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

describe('nx release - repeat publishing', () => {
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

  it('should not error when publishing multiple times and to different dist-tags', () => {
    const publishOutput = runCLI(`release publish`);
    // This is the verdaccio instance that the e2e tests themselves are working from
    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();
    expect(publishOutput).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}



      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@0.0.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       0.0.0
      filename:      proj-{project-name}-0.0.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@0.0.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       0.0.0
      filename:      proj-{project-name}-0.0.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"

      > nx run {project-name}:nx-release-publish


      📦  @proj/{project-name}@0.0.0
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{project-name}
      version:       0.0.0
      filename:      proj-{project-name}-0.0.0.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      >  NX   Successfully ran target nx-release-publish for 3 projects



    `);

    const publishOutput2 = runCLI(`release publish`);
    expect(publishOutput2).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}



      > nx run {project-name}:nx-release-publish

      Skipped package "@proj/{project-name}" from project "{project-name}", as v0.0.0 already exists in ${e2eRegistryUrl} with tag "latest"

      > nx run {project-name}:nx-release-publish

      Skipped package "@proj/{project-name}" from project "{project-name}", as v0.0.0 already exists in ${e2eRegistryUrl} with tag "latest"

      > nx run {project-name}:nx-release-publish

      Skipped package "@proj/{project-name}" from project "{project-name}", as v0.0.0 already exists in ${e2eRegistryUrl} with tag "latest"



      >  NX   Successfully ran target nx-release-publish for 3 projects



    `);

    const publishOutputNewDistTag = runCLI(`release publish --tag next`);
    expect(publishOutputNewDistTag).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}

      With additional flags:
      --tag=next



      > nx run {project-name}:nx-release-publish

      Added the dist-tag next to v0.0.0 for registry ${e2eRegistryUrl}.


      > nx run {project-name}:nx-release-publish

      Added the dist-tag next to v0.0.0 for registry ${e2eRegistryUrl}.


      > nx run {project-name}:nx-release-publish

      Added the dist-tag next to v0.0.0 for registry ${e2eRegistryUrl}.




      >  NX   Successfully ran target nx-release-publish for 3 projects



    `);

    const publishOutputNewDistTag2 = runCLI(`release publish --tag next`);
    expect(publishOutputNewDistTag2).toMatchInlineSnapshot(`

      >  NX   Running target nx-release-publish for 3 projects:

      - {project-name}
      - {project-name}
      - {project-name}

      With additional flags:
      --tag=next



      > nx run {project-name}:nx-release-publish

      Skipped package "@proj/{project-name}" from project "{project-name}", as v0.0.0 already exists in ${e2eRegistryUrl} with tag "next"

      > nx run {project-name}:nx-release-publish

      Skipped package "@proj/{project-name}" from project "{project-name}", as v0.0.0 already exists in ${e2eRegistryUrl} with tag "next"

      > nx run {project-name}:nx-release-publish

      Skipped package "@proj/{project-name}" from project "{project-name}", as v0.0.0 already exists in ${e2eRegistryUrl} with tag "next"



      >  NX   Successfully ran target nx-release-publish for 3 projects



    `);
  });
});
