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

describe('nx release with version plans and project filter', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

  const exists = (filePath: string) => existsSync(filePath);

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

    // Enable independent versioning with version plans
    updateJson('nx.json', (nxJson) => {
      nxJson.release = {
        projectsRelationship: 'independent',
        versionPlans: true,
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

  it('should only delete version plans that exclusively apply to filtered projects', async () => {
    const versionPlansDir = tmpProjPath('.nx/version-plans');
    await ensureDir(versionPlansDir);
    const pkg1VersionPlan = join(versionPlansDir, 'bump-pkg1.md');
    const pkg2VersionPlan = join(versionPlansDir, 'bump-pkg2.md');
    const pkg3VersionPlan = join(versionPlansDir, 'bump-pkg3.md');

    // Create version plan for pkg1 only
    await writeFile(
      pkg1VersionPlan,
      `---
${pkg1}: minor
---

Update package 1 with a minor bump
`
    );

    // Create version plan for pkg2 only
    await writeFile(
      pkg2VersionPlan,
      `---
${pkg2}: patch
---

Update package 2 with a patch bump
`
    );

    // Create version plan for pkg3 only
    await writeFile(
      pkg3VersionPlan,
      `---
${pkg3}: major
---

Update packages 3 with major
`
    );

    await runCommandAsync(`git add ${versionPlansDir}`);
    await runCommandAsync(`git commit -m "chore: add version plans"`);

    // Verify all version plans exist before release
    expect(exists(pkg1VersionPlan)).toBeTruthy();
    expect(exists(pkg2VersionPlan)).toBeTruthy();
    expect(exists(pkg3VersionPlan)).toBeTruthy();

    // Run release with filter for only pkg1
    const result = runCLI(`release -p ${pkg1} --skip-publish --verbose`);

    // Verify pkg1 was versioned
    expect(readJson(`${pkg1}/package.json`).version).toEqual('0.1.0');

    // Verify pkg2 and pkg3 were NOT versioned
    expect(readJson(`${pkg2}/package.json`).version).toEqual('0.0.1');
    expect(readJson(`${pkg3}/package.json`).version).toEqual('0.0.1');

    // - bump-pkg1.md should be deleted (only affects pkg1, which is in the filter)
    expect(exists(pkg1VersionPlan)).toBeFalsy();

    // - bump-pkg2.md should be preserved (affects pkg2, which is not in the filter)
    expect(exists(pkg2VersionPlan)).toBeTruthy();

    // - bump-pkg3.md should be preserved (affects pkg3, which is not in the filter)
    expect(exists(pkg3VersionPlan)).toBeTruthy();
  }, 120000);

  it('should error if version plan contains packages not in the filter', async () => {
    const versionPlansDir = tmpProjPath('.nx/version-plans');
    await ensureDir(versionPlansDir);

    // Create a version plan that affects multiple packages
    await writeFile(
      join(versionPlansDir, 'bump-multiple.md'),
      `---
${pkg1}: minor
${pkg2}: patch
---

Update multiple packages
`
    );

    await runCommandAsync(`git add ${versionPlansDir}`);
    await runCommandAsync(
      `git commit -m "chore: add multi-package version plan"`
    );

    // Try to release only pkg1 when version plan affects both pkg1 and pkg2
    // EXPECTED: Should error because version plan contains pkg2 which is not in filter
    const result = runCLI(`release -p ${pkg1} --skip-publish`, {
      silenceError: true,
    });

    expect(result).toContain(
      'Version plan contains projects not included in the release filter'
    );

    // Version plan should NOT be deleted since release failed
    expect(exists(join(versionPlansDir, 'bump-multiple.md'))).toBeTruthy();
  }, 120000);
});
