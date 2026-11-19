import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateJson,
} from '@nx/e2e-utils';
import { prepareAndInstallDependencies, setupWorkspaces } from './utils';

describe('nx release publish - release groups pulled in by updateDependents', () => {
  // group-a = [pkgA, pkgC] is the group the user selects.
  // group-b = [pkgB, pkgE] is pulled in because pkgB depends on pkgC; pkgE depends on nothing.
  // apps = [privateApp] is pulled in because privateApp depends on pkgC, and it cannot be published.
  let pkgA: string;
  let pkgB: string;
  let pkgC: string;
  let pkgE: string;
  let privateApp: string;
  const packageManager = getSelectedPackageManager();

  const publishRunFor = (project: string) =>
    `nx run ${project}:nx-release-publish`;

  beforeAll(async () => {
    newProject({
      packages: ['@nx/js'],
    });

    // Keep generated package names aligned with the fixture's dependencies.
    updateJson('package.json', (json) => ({ ...json, name: '@proj/source' }));

    pkgA = uniq('alpha');
    pkgB = uniq('bravo');
    pkgC = uniq('charlie');
    pkgE = uniq('echo');
    privateApp = uniq('private-app');
    for (const pkg of [pkgA, pkgB, pkgC, pkgE, privateApp]) {
      runCLI(`generate @nx/workspace:npm-package ${pkg}`);
    }

    const dependencyOnC = packageManager === 'pnpm' ? 'workspace:*' : '0.0.0';
    for (const dependent of [pkgA, pkgB, privateApp]) {
      updateJson(`${dependent}/package.json`, (json) => {
        json.dependencies ??= {};
        json.dependencies[`@proj/${pkgC}`] = dependencyOnC;
        if (dependent === privateApp) {
          json.private = true;
        }
        return json;
      });
    }

    setupWorkspaces(packageManager, pkgA, pkgB, pkgC, pkgE, privateApp);
    await prepareAndInstallDependencies(
      packageManager,
      getPackageManagerCommand({ packageManager }).install
    );

    updateJson('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'group-a': {
            projectsRelationship: 'independent',
            projects: [pkgA, pkgC],
          },
          'group-b': {
            projectsRelationship: 'independent',
            projects: [pkgB, pkgE],
          },
          apps: {
            projectsRelationship: 'independent',
            projects: [privateApp],
          },
        },
        version: {
          currentVersionResolver: 'disk',
        },
        changelog: {
          workspaceChangelog: false,
          projectChangelogs: false,
        },
      };
      return nxJson;
    });

    runCommand(`git add .`);
    runCommand(`git commit -m "chore: initial setup"`);
  }, 300000);

  afterAll(() => cleanupProject());

  it('should publish only the versioned dependents, and skip private ones, when releasing a group', () => {
    const output = runCLI(`release patch --groups=group-a --dry-run --yes`);

    for (const project of [pkgA, pkgB, pkgC]) {
      expect(output).toContain(publishRunFor(project));
    }
    expect(output).toContain(`New version 0.0.1 written to manifest: ${pkgB}`);
    expect(output).not.toContain(`written to manifest: ${pkgE}`);
    expect(output).not.toContain(publishRunFor(pkgE));
    expect(output).not.toContain(publishRunFor(privateApp));
    expect(output).not.toContain('were matched for publishing');
  }, 300000);

  it('should publish only the dependents of a pulled in group when running the publish subcommand', () => {
    const groupsOutput = runCLI(`release publish --groups=group-a --dry-run`);

    for (const project of [pkgA, pkgB, pkgC]) {
      expect(groupsOutput).toContain(publishRunFor(project));
    }
    expect(groupsOutput).not.toContain(publishRunFor(pkgE));
    expect(groupsOutput).not.toContain(publishRunFor(privateApp));

    const projectsOutput = runCLI(`release publish -p ${pkgC} --dry-run`);

    for (const project of [pkgB, pkgC]) {
      expect(projectsOutput).toContain(publishRunFor(project));
    }
    expect(projectsOutput).not.toContain(publishRunFor(pkgE));
    expect(projectsOutput).not.toContain(publishRunFor(privateApp));
  }, 300000);

  it('should still error when the selected group has no publishable projects', () => {
    const output = runCLI(`release publish --groups=apps --dry-run`, {
      silenceError: true,
    });

    expect(output).toContain(
      `the following projects were matched for publishing but do not have the "nx-release-publish" target specified:`
    );
    expect(output).toContain(`- ${privateApp}`);
  }, 300000);
});
