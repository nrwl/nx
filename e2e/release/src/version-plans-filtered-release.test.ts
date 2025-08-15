import { existsSync } from 'fs';
import { ensureDir, writeFile } from 'fs-extra';
import { join } from 'path';
import {
  cleanupProject,
  newProject,
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
        ...nxJson.release,
        projectsRelationship: 'independent',
        versionPlans: true,
        version: {
          conventionalCommits: false,
          generatorOptions: {
            specifierSource: 'version-plans',
          },
        },
        changelog: {
          workspaceChangelog: false,
          projectChangelogs: {
            createRelease: false,
          },
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

    // Create version plan for pkg1 only
    await writeFile(
      join(versionPlansDir, 'bump-pkg1.md'),
      `---
${pkg1}: minor
---

Update package 1 with a minor bump
`
    );

    // Create version plan for pkg2 only
    await writeFile(
      join(versionPlansDir, 'bump-pkg2.md'),
      `---
${pkg2}: patch
---

Update package 2 with a patch bump
`
    );

    // Create version plan for pkg3 only
    await writeFile(
      join(versionPlansDir, 'bump-pkg3.md'),
      `---
${pkg3}: major
---

Update packages 3 with major
`
    );

    await runCommandAsync(`git add ${versionPlansDir}`);
    await runCommandAsync(`git commit -m "chore: add version plans"`);

    // Verify all version plans exist before release
    expect(exists(join(versionPlansDir, 'bump-pkg1.md'))).toBeTruthy();
    expect(exists(join(versionPlansDir, 'bump-pkg2.md'))).toBeTruthy();
    expect(exists(join(versionPlansDir, 'bump-pkg3.md'))).toBeTruthy();

    // Run release with filter for only pkg1
    const result = runCLI(`release -p ${pkg1} --skip-publish --verbose`, {
      silenceError: true,
    });

    // Verify pkg1 was versioned
    expect(result).toContain(`${pkg1} ❓ Applied`);

    // Verify pkg2 and pkg3 were NOT versioned
    expect(result).not.toContain(`${pkg2} ❓ Applied`);
    expect(result).not.toContain(`${pkg3} ❓ Applied`);

    // - bump-pkg1.md should be deleted (only affects pkg1, which is in the filter)
    expect(exists(join(versionPlansDir, 'bump-pkg1.md'))).toBeFalsy();

    // - bump-pkg2.md should be preserved (affects pkg2, which is not in the filter)
    expect(exists(join(versionPlansDir, 'bump-pkg2.md'))).toBeTruthy();

    // - bump-pkg3.md should be preserved (affects pkg3, which is not in the filter)
    expect(exists(join(versionPlansDir, 'bump-pkg3.md'))).toBeTruthy();
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
      'version plan contains projects not included in the release filter'
    );

    // Version plan should NOT be deleted since release failed
    expect(exists(join(versionPlansDir, 'bump-multiple.md'))).toBeTruthy();
  }, 120000);
});
