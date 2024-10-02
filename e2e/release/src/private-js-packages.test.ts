import {
  cleanupProject,
  newProject,
  runCLI,
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
        .replaceAll(/public-pkg-\d+/g, '{public-project-name}')
        .replaceAll(/private-pkg\d+/g, '{private-project-name}')
        .replaceAll(/\s\/{private-project-name}/g, ' {private-project-name}')
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

describe('nx release - private JS packages', () => {
  let publicPkg1: string;
  let publicPkg2: string;
  let privatePkg: string;

  beforeAll(() => {
    newProject({
      packages: ['@nx/js'],
    });

    publicPkg1 = uniq('public-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${publicPkg1}`);

    publicPkg2 = uniq('public-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${publicPkg2}`);

    privatePkg = uniq('private-pkg');
    runCLI(`generate @nx/workspace:npm-package ${privatePkg}`);
    updateJson(`${privatePkg}/package.json`, (json) => {
      json.private = true;
      return json;
    });

    /**
     * Update public-pkg2 to depend on private-pkg.
     *
     * At the time of writing this is not something we protect the user against,
     * so we expect this to not cause any issues, and public-pkg2 will be published.
     *
     * TODO: these tests will need to be updated when we add support for protecting against this
     */
    updateJson(`${publicPkg2}/package.json`, (json) => {
      json.dependencies ??= {};
      json.dependencies[`@proj/${privatePkg}`] = '0.0.0';
      return json;
    });

    /**
     * Configure independent releases in the most minimal way possible so that we can publish
     * the projects independently.
     */
    updateJson('nx.json', () => {
      return {
        release: {
          projectsRelationship: 'independent',
        },
      };
    });
  });
  afterAll(() => cleanupProject());

  it('should skip private packages and log a warning when private packages are explicitly configured', async () => {
    updateJson('nx.json', (json) => {
      json.release.projects = [publicPkg1, publicPkg2, privatePkg];
      return json;
    });

    runCLI(`release version 999.9.9`);

    // This is the verdaccio instance that the e2e tests themselves are working from
    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();

    // Thanks to the custom serializer above, the publish output should be deterministic
    const publicPkg1PublishOutput = runCLI(`release publish -p ${publicPkg1}`);
    expect(publicPkg1PublishOutput).toMatchInlineSnapshot(`

      NX   Your filter "{public-project-name}" matched the following projects:

      - {public-project-name}


      NX   Running target nx-release-publish for project {public-project-name}:

      - {public-project-name}



      > nx run {public-project-name}:nx-release-publish


      📦  @proj/{public-project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{public-project-name}
      version:       999.9.9
      filename:      proj-{public-project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      NX   Successfully ran target nx-release-publish for project {public-project-name}



    `);

    // This will not include the private package dependency because we are filtering to specifically publicPkg2
    const publicPkg2PublishOutput = runCLI(`release publish -p ${publicPkg2}`);
    expect(publicPkg2PublishOutput).toMatchInlineSnapshot(`

      NX   Your filter "{public-project-name}" matched the following projects:

      - {public-project-name}


      NX   Running target nx-release-publish for project {public-project-name}:

      - {public-project-name}



      > nx run {public-project-name}:nx-release-publish


      📦  @proj/{public-project-name}@999.9.9
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{public-project-name}
      version:       999.9.9
      filename:      proj-{public-project-name}-999.9.9.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      NX   Successfully ran target nx-release-publish for project {public-project-name}



    `);

    const privatePkgPublishOutput = runCLI(`release publish -p ${privatePkg}`, {
      silenceError: true,
    });
    expect(privatePkgPublishOutput).toMatchInlineSnapshot(`

      NX   Your filter "{private-project-name}" matched the following projects:

      - {private-project-name}


      NX   Based on your config, the following projects were matched for publishing but do not have the "nx-release-publish" target specified:

      - {private-project-name}

      This is usually caused by not having an appropriate plugin, such as "@nx/js" installed, which will add the appropriate "nx-release-publish" target for you automatically.

      Pass --verbose to see the stacktrace.


    `);

    // The two public packages should have been published
    expect(
      execSync(`npm view @proj/${publicPkg1} version`).toString().trim()
    ).toEqual('999.9.9');
    expect(
      execSync(`npm view @proj/${publicPkg2} version`).toString().trim()
    ).toEqual('999.9.9');

    // The private package should have never been published
    expect(() => execSync(`npm view @proj/${privatePkg} version`)).toThrowError(
      /npm ERR! code E404/
    );
  }, 500000);

  it('should skip private packages and not log a warning when no projects config exists', async () => {
    updateJson('nx.json', (json) => {
      delete json.release.projects;
      return json;
    });

    runCLI(`release version 999.9.10`);

    // This is the verdaccio instance that the e2e tests themselves are working from
    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();

    // Thanks to the custom serializer above, the publish output should be deterministic
    const publishOutput = runCLI(`release publish`);
    expect(publishOutput).toMatchInlineSnapshot(`

      NX   Running target nx-release-publish for 2 projects:

      - {public-project-name}
      - {public-project-name}



      > nx run {public-project-name}:nx-release-publish


      📦  @proj/{public-project-name}@999.9.10
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{public-project-name}
      version:       999.9.10
      filename:      proj-{public-project-name}-999.9.10.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"

      > nx run {public-project-name}:nx-release-publish


      📦  @proj/{public-project-name}@999.9.10
      === Tarball Contents ===

      XXB  index.js
      XXXB package.json
      XXB  project.json
      === Tarball Details ===
      name:          @proj/{public-project-name}
      version:       999.9.10
      filename:      proj-{public-project-name}-999.9.10.tgz
      package size: XXXB
      unpacked size: XXXB
      shasum:        {SHASUM}
      integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      total files:   3

      Published to ${e2eRegistryUrl} with tag "latest"



      NX   Successfully ran target nx-release-publish for 2 projects



    `);

    // The two public packages should have been published
    expect(
      execSync(`npm view @proj/${publicPkg1} version`).toString().trim()
    ).toEqual('999.9.10');
    expect(
      execSync(`npm view @proj/${publicPkg2} version`).toString().trim()
    ).toEqual('999.9.10');

    // The private package should have never been published
    expect(() => execSync(`npm view @proj/${privatePkg} version`)).toThrowError(
      /npm ERR! code E404/
    );
  }, 500000);
});
