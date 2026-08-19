import {
  cleanupProject,
  newProject,
  readJson,
  removeFile,
  runCLI,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

/**
 * `nx release version` rewrites manifests through a Tree and then formats the
 * changed files in memory (`release/version.ts` -> `formatChangedFiles`). That
 * is a different code path from `nx format`, which shells out to the formatter's
 * own CLI, and it is the path #30403 reported: a workspace that formats with
 * something else had its files rewritten by Prettier during a release.
 *
 * Key order is what makes this observable. The manifest is rewritten by
 * `writeJson` either way, so indentation cannot tell the two apart - but oxfmt's
 * `sortPackageJson` defaults to true, so only a formatted manifest comes back in
 * npm's canonical key order.
 */
describe('nx release formatting', () => {
  let pkg: string;

  beforeAll(() => {
    // `newProject` creates with oxfmt, which is the fixture default.
    newProject({ packages: ['@nx/js'] });
    pkg = uniq('my-pkg');
    runCLI(`generate @nx/workspace:npm-package ${pkg}`);
  });

  afterAll(() => cleanupProject());

  it('formats a manifest it rewrites on an oxfmt workspace', () => {
    setManifestKeyOrder('0.0.1');

    runCLI('release version patch');

    // oxfmt sorted them: `name` ahead of `version`, and `license` ahead of the
    // dependency blocks.
    expect(Object.keys(readJson(`${pkg}/package.json`))).toEqual([
      'name',
      'version',
      'license',
    ]);
  });

  it('leaves a manifest alone when no formatter is configured', () => {
    // Both halves are required: detection accepts a declared `oxfmt` dependency
    // even with no config file, so deleting only the config still resolves to
    // oxfmt.
    removeFile('.oxfmtrc.json');
    updateJson<{ devDependencies?: Record<string, string> }>(
      'package.json',
      (json) => {
        delete json.devDependencies?.['oxfmt'];
        return json;
      }
    );

    setManifestKeyOrder('0.0.5');

    runCLI('release version patch');

    // The version bumped, and nothing reordered the keys around it - the
    // fail-open path #30403 asked for.
    const after = readJson<{ version: string }>(`${pkg}/package.json`);
    expect(after.version).toEqual('0.0.6');
    expect(Object.keys(after)).toEqual(['version', 'name', 'license']);
  });

  function setManifestKeyOrder(version: string) {
    updateJson(`${pkg}/package.json`, (json) => ({
      // Deliberately not npm's canonical order, so a formatter that runs is
      // visible and one that does not is too.
      version,
      name: json.name,
      license: 'MIT',
    }));
  }
});
