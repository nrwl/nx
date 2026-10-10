import { existsSync } from 'fs';
import { ensureDir, writeFile } from 'fs-extra';
import { join } from 'path';
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

describe('nx release with version plans and multiple release groups', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

  const versionPlansDir = () => tmpProjPath('.nx/version-plans');

  const writeVersionPlan = async (fileName: string, content: string) => {
    await ensureDir(versionPlansDir());
    const filePath = join(versionPlansDir(), fileName);
    await writeFile(filePath, content);
    await runCommandAsync(`git add ${versionPlansDir()}`);
    await runCommandAsync(`git commit -m "chore: add ${fileName}"`);
    return filePath;
  };

  beforeAll(async () => {
    newProject({
      packages: ['@nx/js'],
      preset: 'ts',
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(
      `generate @nx/js:library ${pkg1} --publishable --importPath=${pkg1}`
    );

    pkg2 = uniq('my-pkg-2');
    runCLI(
      `generate @nx/js:library ${pkg2} --publishable --importPath=${pkg2}`
    );

    pkg3 = uniq('my-pkg-3');
    runCLI(
      `generate @nx/js:library ${pkg3} --publishable --importPath=${pkg3}`
    );

    updateJson('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'group-a': {
            projectsRelationship: 'independent',
            projects: [pkg1],
          },
          'group-b': {
            projectsRelationship: 'fixed',
            projects: [pkg2, pkg3],
          },
        },
        versionPlans: true,
        version: {
          adjustSemverBumpsForZeroMajorVersion: false,
        },
        changelog: {
          workspaceChangelog: false,
        },
      };
      return nxJson;
    });

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial setup"`);
  }, 120000);

  afterAll(() => cleanupProject());

  it('should release a filtered group while leaving version plans for other groups pending', async () => {
    const pkg1VersionPlan = await writeVersionPlan(
      'bump-pkg1.md',
      `---
${pkg1}: minor
---

Update package 1 with a minor bump
`
    );
    const groupBVersionPlan = await writeVersionPlan(
      'bump-group-b.md',
      `---
group-b: patch
---

Update group b with a patch bump
`
    );

    runCLI(`release --groups=group-a --skip-publish`);

    expect(readJson(`${pkg1}/package.json`).version).toEqual('0.1.0');
    expect(readJson(`${pkg2}/package.json`).version).toEqual('0.0.1');
    expect(readJson(`${pkg3}/package.json`).version).toEqual('0.0.1');
    expect(existsSync(pkg1VersionPlan)).toBeFalsy();
    expect(existsSync(groupBVersionPlan)).toBeTruthy();

    const nextPkg1VersionPlan = await writeVersionPlan(
      'bump-pkg1-again.md',
      `---
${pkg1}: patch
---

Update package 1 with a patch bump
`
    );

    runCLI(`release -p ${pkg1} --skip-publish`);

    expect(readJson(`${pkg1}/package.json`).version).toEqual('0.1.1');
    expect(readJson(`${pkg2}/package.json`).version).toEqual('0.0.1');
    expect(existsSync(nextPkg1VersionPlan)).toBeFalsy();
    expect(existsSync(groupBVersionPlan)).toBeTruthy();
  }, 120000);

  it('should error if a version plan spans a filtered and an unfiltered release group', async () => {
    const sharedVersionPlan = await writeVersionPlan(
      'bump-shared.md',
      `---
${pkg1}: patch
${pkg2}: minor
---

Update packages across groups
`
    );

    const result = runCLI(`release --groups=group-a --skip-publish`, {
      silenceError: true,
    });

    expect(result).toContain(
      'Version plan contains projects not included in the release filter'
    );
    expect(result).toContain(`version plan 'bump-shared.md'`);
    expect(readJson(`${pkg1}/package.json`).version).toEqual('0.1.1');
    expect(existsSync(sharedVersionPlan)).toBeTruthy();
  }, 120000);
});
