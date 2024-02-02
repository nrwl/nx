import {
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

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

describe('nx release lock file updates', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let previousPackageManager: string;
  let previousYarnEnableImmutableInstalls: string;

  beforeAll(() => {
    previousPackageManager = process.env.SELECTED_PM;
    previousYarnEnableImmutableInstalls =
      process.env.YARN_ENABLE_IMMUTABLE_INSTALLS;
  });

  // project will be created by each test individually
  // in order to test different package managers
  const initializeProject = (packageManager: 'npm' | 'yarn' | 'pnpm') => {
    process.env.SELECTED_PM = packageManager;

    newProject({
      unsetProjectNameAndRootFormat: false,
      packages: ['@nx/js'],
      packageManager,
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
  };

  afterEach(() => {
    cleanupProject();
  });

  afterAll(() => {
    process.env.SELECTED_PM = previousPackageManager;
    process.env.YARN_ENABLE_IMMUTABLE_INSTALLS =
      previousYarnEnableImmutableInstalls;
  });

  it('should update package-lock.json when package manager is npm', async () => {
    initializeProject('npm');

    runCommand(`npm install`);

    // workaround for NXC-143
    runCLI('reset');

    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial commit"`);

    const versionOutput = runCLI(`release version 999.9.9`);

    expect(versionOutput.match(/NX   Updating npm lock file/g).length).toBe(1);

    const filesChanges = runCommand('git diff --name-only HEAD');

    expect(filesChanges).toMatchInlineSnapshot(`
      {project-name}/package.json
      {project-name}/package.json
      {project-name}/package.json
      package-lock.json

    `);
  });

  it('should not update lock file when package manager is yarn classic', async () => {
    initializeProject('yarn');

    updateJson('package.json', (json) => {
      json.workspaces = [pkg1, pkg2, pkg3];
      return json;
    });

    runCommand(`corepack prepare yarn@1.22.19 --activate`);
    runCommand(`yarn set version 1.22.19`);
    runCommand(`yarn install`);

    // workaround for NXC-143
    runCLI('reset');

    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial commit"`);

    const versionOutput = runCLI(`release version 999.9.9 --verbose`);

    expect(
      versionOutput.match(
        /Skipped lock file update because it is not necessary for Yarn Classic./g
      ).length
    ).toBe(1);

    const filesChanges = runCommand('git diff --name-only HEAD');

    expect(filesChanges).toMatchInlineSnapshot(`
      {project-name}/package.json
      {project-name}/package.json
      {project-name}/package.json

    `);
  });

  it('should update yarn.lock when package manager is yarn', async () => {
    process.env.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';

    initializeProject('yarn');

    updateJson('package.json', (json) => {
      json.workspaces = [pkg1, pkg2, pkg3];
      return json;
    });

    runCommand(`corepack prepare yarn@4.0.2 --activate`);
    runCommand(`yarn set version 4.0.2`);
    runCommand(`yarn install`);

    // workaround for NXC-143
    runCLI('reset');

    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial commit"`);

    const versionOutput = runCLI(`release version 999.9.9`);

    expect(versionOutput.match(/NX   Updating yarn lock file/g).length).toBe(1);

    const filesChanges = runCommand('git diff --name-only HEAD');

    expect(filesChanges).toMatchInlineSnapshot(`
      .yarn/install-state.gz
      {project-name}/package.json
      {project-name}/package.json
      {project-name}/package.json
      yarn.lock

    `);
  });

  it('should update pnpm-lock.yaml when package manager is pnpm', async () => {
    initializeProject('pnpm');

    updateFile(
      'pnpm-workspace.yaml',
      `packages:\n - ${pkg1}\n - ${pkg2}\n - ${pkg3}\n`
    );

    // workaround for NXC-143
    runCLI('reset');

    runCommand(`pnpm install`);

    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial commit"`);

    const versionOutput = runCLI(`release version 999.9.9`);

    expect(versionOutput.match(/NX   Updating pnpm lock file/g).length).toBe(1);

    const filesChanges = runCommand('git diff --name-only HEAD');

    expect(filesChanges).toMatchInlineSnapshot(`
      {project-name}/package.json
      {project-name}/package.json
      {project-name}/package.json
      pnpm-lock.yaml

    `);
  });
});
