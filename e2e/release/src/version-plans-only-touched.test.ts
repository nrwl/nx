import { NxJsonConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  uniq,
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
        .replaceAll(/version-plan-\d*.md/g, 'version-plan-XXX.md')
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

describe('nx release version plans only touched', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let pkg4: string;
  let pkg5: string;

  beforeEach(async () => {
    newProject({
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
    await runCommandAsync(`git tag -a v0.0.0 -m "v0.0.0"`);
    await runCommandAsync(`git tag -a ${pkg3}@0.0.0 -m "${pkg3}@0.0.0"`);
    await runCommandAsync(`git tag -a ${pkg4}@0.0.0 -m "${pkg4}@0.0.0"`);
    await runCommandAsync(`git tag -a ${pkg5}@0.0.0 -m "${pkg5}@0.0.0"`);
  }, 60000);

  afterEach(() => cleanupProject());

  it('should pick new versions based on version plans', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
            releaseTagPattern: 'v{version}',
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
            releaseTagPattern: '{projectName}@{version}',
          },
        },
        version: {
          generatorOptions: {
            specifierSource: 'version-plans',
          },
        },
        changelog: {
          projectChangelogs: true,
        },
        versionPlans: true,
      };
      return nxJson;
    });

    const noChangedProjectsResult = runCLI(
      'release plan minor -m "Should not happen due to no changed projects" --verbose',
      {
        silenceError: true,
      }
    );

    expect(noChangedProjectsResult).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json


      NX   No touched projects found based on changed files under release group "fixed-group"


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   No version bumps were selected so no version plan file was created.

      This might be because no projects have been changed, or projects you expected to release have not been touched
      To include all projects, not just those that have been changed, pass --only-touched=false
      Alternatively, you can specify alternate --base and --head refs to include only changes from certain commits


    `);

    await runCommandAsync(`touch ${pkg1}/test.txt`);

    const changedProjectsResult = runCLI(
      'release plan minor -m "Should happen due to changed project 1" --verbose'
    );

    expect(changedProjectsResult).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - {project-name}/test.txt


      NX   Touched projects based on changed files under release group "fixed-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   Creating version plan file "version-plan-XXX.md"

      + ---
      + fixed-group: minor
      + ---
      +
      + Should happen due to changed project 1
      +


    `);

    await runCommandAsync(`git checkout -b branch1`);
    await runCommandAsync(`git checkout -b branch2`);
    await runCommandAsync(`git add ${pkg1}/test.txt`);
    await runCommandAsync(`git commit -m "chore: update pkg1"`);
    await runCommandAsync(`git checkout -b branch3`);
    await runCommandAsync(`touch ${pkg3}/test.txt`);
    await runCommandAsync(`git add ${pkg3}/test.txt`);
    await runCommandAsync(`git commit -m "chore: update pkg3"`);

    const changedProjectsResult2 = runCLI(
      'release plan minor -m "Should happen due to changed project 1 and 3" --verbose'
    );

    expect(changedProjectsResult2).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - {project-name}/test.txt
      - {project-name}/test.txt
      - nx.json
      - .nx/version-plans/version-plan-XXX.md


      NX   Touched projects based on changed files under release group "fixed-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects based on changed files under release group "independent-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Creating version plan file "version-plan-XXX.md"

      + ---
      + fixed-group: minor
      + {project-name}: minor
      + ---
      +
      + Should happen due to changed project 1 and 3
      +


    `);

    const changedProjectsResult3 = runCLI(
      `release plan minor -m "Should happen due to changed project 3 only" --verbose --base=branch2`
    );

    expect(changedProjectsResult3).toMatchInlineSnapshot(`

      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - {project-name}/test.txt
      - nx.json
      - .nx/version-plans/version-plan-XXX.md
      - .nx/version-plans/version-plan-XXX.md


      NX   No touched projects found based on changed files under release group "fixed-group"


      NX   Touched projects based on changed files under release group "independent-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Creating version plan file "version-plan-XXX.md"

      + ---
      + {project-name}: minor
      + ---
      +
      + Should happen due to changed project 3 only
      +


    `);

    const changedProjectsResult4 = runCLI(
      `release plan minor -m "Should happen due to changed project 1 only" --verbose --base=branch1 --head=branch2`
    );

    expect(changedProjectsResult4).toMatchInlineSnapshot(`

      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (branch2)

      - {project-name}/test.txt


      NX   Touched projects based on changed files under release group "fixed-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   Creating version plan file "version-plan-XXX.md"

      + ---
      + fixed-group: minor
      + ---
      +
      + Should happen due to changed project 1 only
      +


    `);
  });
});
