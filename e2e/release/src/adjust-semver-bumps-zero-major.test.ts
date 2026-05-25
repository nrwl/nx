import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

/**
 * End-to-end coverage for the v23 default flip of
 * `release.version.adjustSemverBumpsForZeroMajorVersion`.
 *
 * The full bump-shifting matrix is covered exhaustively by the unit tests in
 * `packages/nx/src/command-line/release/utils/semver.spec.ts`. The goal here is
 * narrower: confirm the default actually wires through the full
 * `nx release version` pipeline (config defaults → resolver → versioning), and
 * that explicitly opting out restores the original SemVer behavior.
 */
describe('nx release adjustSemverBumpsForZeroMajorVersion default', () => {
  let pkg: string;

  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });
    pkg = uniq('my-pkg');
    runCLI(`generate @nx/workspace:npm-package ${pkg}`);
  });

  afterAll(() => cleanupProject());

  it('shifts a "major" bump down to a minor for 0.x projects by default', () => {
    setStartingVersion('0.1.0');
    setReleaseConfig({});
    expect(runCLI(`release version major -d`)).toMatch(/new version 0\.2\.0/);
  });

  it('leaves bumps unadjusted for 1.x+ projects regardless of the default', () => {
    setStartingVersion('1.0.0');
    setReleaseConfig({});
    expect(runCLI(`release version major -d`)).toMatch(/new version 2\.0\.0/);
  });

  it('restores the original SemVer behavior when opted out with adjustSemverBumpsForZeroMajorVersion: false', () => {
    setStartingVersion('0.1.0');
    setReleaseConfig({
      version: { adjustSemverBumpsForZeroMajorVersion: false },
    });
    expect(runCLI(`release version major -d`)).toMatch(/new version 1\.0\.0/);
  });

  function setStartingVersion(version: string) {
    updateJson<{ version: string }>(`${pkg}/package.json`, (json) => ({
      ...json,
      version,
    }));
  }

  function setReleaseConfig(release: NxJsonConfiguration['release']) {
    updateJson<NxJsonConfiguration>('nx.json', (json) => ({
      ...json,
      release,
    }));
  }
});
