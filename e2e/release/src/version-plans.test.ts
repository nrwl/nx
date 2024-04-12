import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e/utils';
import { ensureDir, writeFile } from 'fs-extra';
import { join } from 'path';

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
        // Normalize the version title date.
        .replaceAll(/\(\d{4}-\d{2}-\d{2}\)/g, '(YYYY-MM-DD)')
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

describe('nx release version plans', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let pkg4: string;
  let pkg5: string;

  beforeAll(async () => {
    newProject({
      unsetProjectNameAndRootFormat: false,
      packages: ['@nx/js'],
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${pkg1}`);

    pkg2 = uniq('my-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${pkg2}`);

    pkg3 = uniq('my-pkg-3');
    runCLI(`generate @nx/workspace:npm-package ${pkg3}`);

    pkg4 = uniq('my-pkg-4');
    runCLI(`generate @nx/workspace:npm-package ${pkg4}`);

    pkg5 = uniq('my-pkg-5');
    runCLI(`generate @nx/workspace:npm-package ${pkg5}`);

    await runCommandAsync(`git add .`);
    await runCommandAsync(`git commit -m "chore: initial commit"`);
    await runCommandAsync(`git tag -a ${pkg1}@0.0.1 -m "${pkg1}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg2}@0.0.1 -m "${pkg2}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg3}@0.0.1 -m "${pkg3}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg4}@0.0.1 -m "${pkg4}@0.0.1"`);
    await runCommandAsync(`git tag -a ${pkg5}@0.0.1 -m "${pkg5}@0.0.1"`);
  }, 60000);
  afterAll(() => cleanupProject());

  it('should pick new versions based on version plans', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
          },
        },
        version: {
          generatorOptions: {
            specifierSource: 'version-plans',
          },
        },
      };
      return nxJson;
    });

    const versionPlansDir = tmpProjPath('.nx/version-plans');
    await ensureDir(versionPlansDir);

    await writeFile(
      join(versionPlansDir, 'bump-fixed.md'),
      `---
fixed-group: minor
---

Update the fixed packages with a minor release.
`
    );

    await writeFile(
      join(versionPlansDir, 'bump-independent.md'),
      `---
independent-group: independent
${pkg3}: patch
${pkg4}: preminor
${pkg5}: prerelease
---

Update the independent packages with a patch, preminor, and prerelease.
`
    );

    const result = runCLI('release version --dry-run --verbose', {
      silenceError: true,
    });

    expect(result).toContain(
      `${pkg1} 📄 Resolved the specifier as "minor" using version plans.`
    );
    // pkg2 uses the previously resolved specifier from pkg1
    expect(result).toContain(
      `${pkg2} ✍️  New version 0.1.0 written to ${pkg2}/package.json`
    );
    expect(result).toContain(
      `${pkg3} 📄 Resolved the specifier as "patch" using version plans.`
    );
    expect(result).toContain(
      `${pkg4} 📄 Resolved the specifier as "preminor" using version plans.`
    );
    expect(result).toContain(
      `${pkg5} 📄 Resolved the specifier as "prerelease" using version plans.`
    );
  });
});
