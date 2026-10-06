import {
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateJson,
} from '@nx/e2e-utils';

describe('nx release - deleted project affectedness', () => {
  let releasedPackageA: string;
  let releasedPackageB: string;
  let retiredPackage: string;

  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });

    releasedPackageA = uniq('released-a');
    releasedPackageB = uniq('released-b');
    retiredPackage = uniq('retired');

    runCLI(`generate @nx/workspace:npm-package ${releasedPackageA}`);
    runCLI(`generate @nx/workspace:npm-package ${releasedPackageB}`);
    runCLI(`generate @nx/workspace:npm-package ${retiredPackage}`);

    runCommand('git config user.email "test@test.com"');
    runCommand('git config user.name "Test"');

    updateJson('nx.json', () => ({
      release: {
        projects: [releasedPackageA, releasedPackageB],
        projectsRelationship: 'independent',
        releaseTag: {
          pattern: '{projectName}@{version}',
        },
        version: {
          currentVersionResolver: 'git-tag',
          specifierSource: 'conventional-commits',
        },
      },
    }));

    runCommand('git add .');
    runCommand('git commit -m "chore: initial commit"');
    runCommand(`git tag ${releasedPackageA}@1.0.0`);
    runCommand(`git tag ${releasedPackageB}@1.0.0`);
    runCommand(`git tag ${retiredPackage}@1.0.0`);

    updateJson(`${retiredPackage}/package.json`, (packageJson) => ({
      ...packageJson,
      description: 'A feature that was released before this package retired',
    }));
    runCommand(`git add ${retiredPackage}/package.json`);
    runCommand(`git commit -m "feat(${retiredPackage}): add an option"`);
    runCommand(`git tag ${retiredPackage}@1.1.0`);

    runCommand(`git rm -r ${retiredPackage}`);
    runCommand('git commit -m "chore: retire package"');
  });

  afterAll(() => cleanupProject());

  it('does not attribute commits for a deleted project to current release projects', () => {
    const output = runCLI('release version --dry-run');

    expect(output).toContain(
      `${releasedPackageA} 🚫 No changes were detected using git history and the conventional commits standard`
    );
    expect(output).toContain(
      `${releasedPackageB} 🚫 No changes were detected using git history and the conventional commits standard`
    );
  });
});
