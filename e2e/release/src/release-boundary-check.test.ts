import { appendFileSync } from 'fs';
import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommandAsync,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

describe('nx release releaseBoundaryCheck', () => {
  let pkgA: string;
  let pkgB: string;
  let pkgC: string;

  const commitChange = async (pkg: string, message: string) => {
    appendFileSync(tmpProjPath(`${pkg}/index.js`), `\n// ${message}\n`);
    await runCommandAsync(`git add ${pkg}`);
    await runCommandAsync(`git commit -m "${message}"`);
  };

  const setReleaseConfig = async (
    groups: Record<string, string[]>,
    version: Record<string, unknown>
  ) => {
    updateJson('nx.json', (nxJson) => {
      nxJson.release = {
        groups: Object.fromEntries(
          Object.entries(groups).map(([name, projects]) => [
            name,
            { projectsRelationship: 'independent', projects },
          ])
        ),
        version: { conventionalCommits: true, ...version },
        changelog: { workspaceChangelog: false },
        git: { commit: false, tag: false },
      };
      return nxJson;
    });
    await runCommandAsync(`git add nx.json`);
    await runCommandAsync(`git commit -m "chore: update release config"`);
  };

  beforeAll(async () => {
    newProject({ packages: ['@nx/js'] });

    pkgA = uniq('pkg-a');
    pkgB = uniq('pkg-b');
    pkgC = uniq('pkg-c');
    for (const pkg of [pkgA, pkgB, pkgC]) {
      runCLI(`generate @nx/workspace:npm-package ${pkg}`);
      updateJson(`${pkg}/package.json`, (json) => {
        json.version = '1.0.0';
        return json;
      });
    }
    for (const dependent of [pkgA, pkgB]) {
      updateJson(`${dependent}/package.json`, (json) => {
        json.dependencies = { [`@proj/${pkgC}`]: '^1.0.0' };
        return json;
      });
    }

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);
    for (const pkg of [pkgA, pkgB, pkgC]) {
      await runCommandAsync(`git tag ${pkg}@1.0.0`);
    }
    await commitChange(pkgC, `feat(${pkgC}): change c`);
  }, 120000);

  afterAll(() => cleanupProject());

  it('should fail before writing anything when updateDependents adds a project from another group and the check is "error"', async () => {
    await setReleaseConfig(
      { 'group-a': [pkgA, pkgC], 'group-b': [pkgB] },
      { releaseBoundaryCheck: 'error' }
    );

    const output = runCLI(`release --groups=group-a --skip-publish`, {
      silenceError: true,
    });

    expect(output).toContain('The release boundary check found');
    expect(output).toContain(
      `"${pkgB}" (release group "group-b") was not selected, but is being released as 1.0.1 because it depends on "${pkgC}"`
    );
    expect(readJson(`${pkgC}/package.json`).version).toEqual('1.0.0');
    expect(readJson(`${pkgB}/package.json`).version).toEqual('1.0.0');
  }, 120000);

  it('should warn about a dependent in another group that is not released and still release when the check is "warn"', async () => {
    await setReleaseConfig(
      { 'group-a': [pkgA, pkgC], 'group-b': [pkgB] },
      { releaseBoundaryCheck: 'warn', updateDependents: 'auto' }
    );

    const output = runCLI(`release --groups=group-a --skip-publish --dry-run`, {
      redirectStderr: true,
    });

    expect(output).toContain(
      `"${pkgB}" (release group "group-b") is not being released, but depends on "${pkgC}", which is being released as 1.1.0. It declares "^1.0.0" in dependencies, which admits the new version without "${pkgB}" being released again.`
    );
    expect(output).toContain('New version 1.1.0 written to manifest');
  }, 120000);

  it('should warn about a dependency in another group with pending changes', async () => {
    await setReleaseConfig(
      { 'group-a': [pkgA], 'group-b': [pkgB], 'group-c': [pkgC] },
      { releaseBoundaryCheck: 'warn' }
    );
    await commitChange(pkgA, `fix(${pkgA}): change a`);

    const output = runCLI(`release --groups=group-a --skip-publish`, {
      redirectStderr: true,
    });

    expect(output).toContain(
      `"${pkgA}" is being released and depends on "${pkgC}" (release group "group-c"), which is not being released but has pending changes (a "minor" bump).`
    );
    expect(readJson(`${pkgA}/package.json`).version).toEqual('1.0.1');
    expect(readJson(`${pkgC}/package.json`).version).toEqual('1.0.0');
  }, 120000);
});
