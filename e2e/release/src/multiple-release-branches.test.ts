import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateJson,
} from '@nx/e2e/utils';

expect.addSnapshotSerializer({
  serialize(str: string) {
    return (
      str
        // Remove all output unique to specific projects to ensure deterministic snapshots
        .replaceAll(`/private/${tmpProjPath()}`, '')
        .replaceAll(tmpProjPath(), '')
        .replaceAll('/private/', '')
        .replaceAll(/my-pkg-\d+/g, '{project-name}')
        .replaceAll(' in /{project-name}', ' in {project-name}')
        .replaceAll(
          /integrity:\s*.*/g,
          'integrity: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        )
        .replaceAll(/\b[0-9a-f]{40}\b/g, '{SHASUM}')
        .replaceAll(/\d*B  index\.js/g, 'XXB  index.js')
        .replaceAll(/\d*B  project\.json/g, 'XXB  project.json')
        .replaceAll(/\d*B package\.json/g, 'XXXB package.json')
        .replaceAll(/\d*B CHANGELOG\.md/g, 'XXXB CHANGELOG.md')
        .replaceAll(/size:\s*\d*\s?B/g, 'size: XXXB')
        .replaceAll(/\d*\.\d*\s?kB/g, 'XXX.XXX kb')
        // Normalize the version title date
        .replaceAll(/\(\d{4}-\d{2}-\d{2}\)/g, '(YYYY-MM-DD)')
        .replaceAll('package-lock.json', '{lock-file}')
        .replaceAll('yarn.lock', '{lock-file}')
        .replaceAll('pnpm-lock.yaml', '{lock-file}')
        .replaceAll('npm install --package-lock-only', '{lock-file-command}')
        .replaceAll(
          'yarn install --mode update-lockfile',
          '{lock-file-command}'
        )
        .replaceAll('pnpm install --lockfile-only', '{lock-file-command}')
        .replaceAll(getSelectedPackageManager(), '{package-manager}')
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

describe('nx release multiple release branches', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;

  beforeEach(() => {
    newProject({
      packages: ['@nx/js'],
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(`generate @nx/workspace:npm-package ${pkg1}`);

    pkg2 = uniq('my-pkg-2');
    runCLI(`generate @nx/workspace:npm-package ${pkg2}`);

    pkg3 = uniq('my-pkg-3');
    runCLI(`generate @nx/workspace:npm-package ${pkg3}`);
  });
  afterEach(() => cleanupProject());

  it('git-tag version resolver should not detect tags in other branches', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        version: {
          git: {
            commit: true,
            tag: true,
          },
          generatorOptions: {
            currentVersionResolver: 'git-tag',
          },
        },
      };

      return json;
    });

    runCommand(`git checkout -b release/0.x`);
    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial commit"`);
    const initialVersionResult = runCLI(
      `release version 0.0.7 --first-release`
    );

    runCommand(`git checkout -b release/1.x`);

    // update my-pkg-1 with a feature commit
    updateJson(`${pkg1}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    runCommand(`git add ${pkg1}/package.json`);
    runCommand(`git commit -m "feat(${pkg1}): new feature 1"`);

    const versionResult1x = runCLI(`release version minor`);

    // update my-pkg-2 with a fix commit
    updateJson(`${pkg2}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    runCommand(`git add ${pkg2}/package.json`);
    runCommand(`git commit -m "fix(${pkg2}): new fix 1"`);
    runCommand(`git checkout release/0.x`);
    const versionResult0x = runCLI(`release version patch`);

    expect(initialVersionResult).toMatchInlineSnapshot(`

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Unable to resolve the current version from git tag using pattern "v{version}". Falling back to the version on disk of 0.0.0
      {project-name} 📄 Using the provided version specifier "0.0.7".
      {project-name} ✍️  New version 0.0.7 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.0 already resolved from disk fallback.
      {project-name} 📄 Using the provided version specifier "0.0.7".
      {project-name} ✍️  New version 0.0.7 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.0 already resolved from disk fallback.
      {project-name} 📄 Using the provided version specifier "0.0.7".
      {project-name} ✍️  New version 0.0.7 written to {project-name}/package.json


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "0.0.7",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "0.0.7",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "0.0.7",
      "scripts": {


      NX   Committing changes with git


      NX   Tagging commit with git


    `);
    expect(versionResult1x).toMatchInlineSnapshot(`

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Resolved the current version as 0.0.7 from git tag "v0.0.7".
      {project-name} 📄 Using the provided version specifier "minor".
      {project-name} ✍️  New version 0.1.0 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.7 already resolved from git tag "v0.0.7".
      {project-name} 📄 Using the provided version specifier "minor".
      {project-name} ✍️  New version 0.1.0 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.7 already resolved from git tag "v0.0.7".
      {project-name} 📄 Using the provided version specifier "minor".
      {project-name} ✍️  New version 0.1.0 written to {project-name}/package.json


      "name": "@proj/{project-name}",
      -   "version": "0.0.7",
      +   "version": "0.1.0",
      "scripts": {

      }
      +


      "name": "@proj/{project-name}",
      -   "version": "0.0.7",
      +   "version": "0.1.0",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.7",
      +   "version": "0.1.0",
      "scripts": {


      NX   Committing changes with git


      NX   Tagging commit with git


    `);
    expect(versionResult0x).toMatchInlineSnapshot(`

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Resolved the current version as 0.0.7 from git tag "v0.0.7".
      {project-name} 📄 Using the provided version specifier "patch".
      {project-name} ✍️  New version 0.0.8 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.7 already resolved from git tag "v0.0.7".
      {project-name} 📄 Using the provided version specifier "patch".
      {project-name} ✍️  New version 0.0.8 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.7 already resolved from git tag "v0.0.7".
      {project-name} 📄 Using the provided version specifier "patch".
      {project-name} ✍️  New version 0.0.8 written to {project-name}/package.json


      "name": "@proj/{project-name}",
      -   "version": "0.0.7",
      +   "version": "0.0.8",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.7",
      +   "version": "0.0.8",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.7",
      +   "version": "0.0.8",
      "scripts": {


      NX   Committing changes with git


      NX   Tagging commit with git


    `);
  });

  it('git-tag version resolver should detect tags in other branches if none are reachable from the current commit', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        version: {
          git: {
            commit: true,
            tag: true,
          },
          generatorOptions: {
            currentVersionResolver: 'git-tag',
          },
        },
      };

      return json;
    });

    runCommand(`git checkout -b test-main`);
    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial commit"`);

    runCommand(`git checkout -b release/1.x`);

    // update my-pkg-1 with a feature commit
    updateJson(`${pkg1}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    runCommand(`git add ${pkg1}/package.json`);
    runCommand(`git commit -m "feat(${pkg1}): new feature 1"`);

    const versionResult1x = runCLI(`release version minor --first-release`);

    runCommand(`git checkout test-main`);
    // update my-pkg-2 with a fix commit
    updateJson(`${pkg2}/package.json`, (json) => ({
      ...json,
      license: 'MIT',
    }));
    runCommand(`git add ${pkg2}/package.json`);
    runCommand(`git commit -m "fix(${pkg2}): new fix 1"`);
    runCommand(`git checkout -b release/2.x`);
    const versionResult2x = runCLI(`release version major`);

    expect(versionResult1x).toMatchInlineSnapshot(`

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Unable to resolve the current version from git tag using pattern "v{version}". Falling back to the version on disk of 0.0.0
      {project-name} 📄 Using the provided version specifier "minor".
      {project-name} ✍️  New version 0.1.0 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.0 already resolved from disk fallback.
      {project-name} 📄 Using the provided version specifier "minor".
      {project-name} ✍️  New version 0.1.0 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.0.0 already resolved from disk fallback.
      {project-name} 📄 Using the provided version specifier "minor".
      {project-name} ✍️  New version 0.1.0 written to {project-name}/package.json


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "0.1.0",
      "scripts": {

      }
      +


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "0.1.0",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "0.1.0",
      "scripts": {


      NX   Committing changes with git


      NX   Tagging commit with git


    `);
    expect(versionResult2x).toMatchInlineSnapshot(`

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Resolved the current version as 0.1.0 from git tag "v0.1.0".
      {project-name} 📄 Using the provided version specifier "major".
      {project-name} ✍️  New version 1.0.0 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.1.0 already resolved from git tag "v0.1.0".
      {project-name} 📄 Using the provided version specifier "major".
      {project-name} ✍️  New version 1.0.0 written to {project-name}/package.json

      NX   Running release version for project: {project-name}

      {project-name} 🔍 Reading data for package "@proj/{project-name}" from {project-name}/package.json
      {project-name} 📄 Using the current version 0.1.0 already resolved from git tag "v0.1.0".
      {project-name} 📄 Using the provided version specifier "major".
      {project-name} ✍️  New version 1.0.0 written to {project-name}/package.json


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "1.0.0",
      "scripts": {


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "1.0.0",
      "scripts": {

      }
      +


      "name": "@proj/{project-name}",
      -   "version": "0.0.0",
      +   "version": "1.0.0",
      "scripts": {


      NX   Committing changes with git


      NX   Tagging commit with git


    `);
  });
});
