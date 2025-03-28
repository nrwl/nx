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
import { readdirSync, readFileSync, writeFileSync } from 'fs-extra';
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
        .replaceAll(/version-plan-\d*\.md/g, 'version-plan-{RANDOM_NUMBER}.md')
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

describe('nx release version plans check command', () => {
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

  it('should work as expected when there are no version plan files on disk', async () => {
    // it should error if version plans are not yet enabled
    expect(runCLI('release plan:check', { silenceError: true }))
      .toMatchInlineSnapshot(`

      NX   Version plans are not enabled

      Please ensure at least one release group has version plans enabled in your Nx release configuration if you want to use this command.


    `);

    // Enable version plans
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        versionPlans: true,
      };
      return json;
    });

    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   No touched projects found based on changed files


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);

    // it should provide more information about changed files and base and head used when --verbose is passed
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json


      NX   No touched projects found based on changed files


      NX   All touched projects have, or do not require, version plans.



    `);
  });

  it('should work as expected when there are version plans on disk for the default release group', async () => {
    // Enable version plans
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        versionPlans: true,
      };
      return json;
    });

    // Create a version plan
    runCLI(
      `release plan minor --message "This is an awesome change" --only-touched=false`
    );

    // it should show information about the pending bumps and print a success message
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   There are pending bumps in version plan(s)

      - "minor" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


  `);

    // it should provide more information about changed files and base and head used when --verbose is passed
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - .nx/version-plans/version-plan-{RANDOM_NUMBER}.md


      NX   There are pending bumps in version plan(s)

      - "minor" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.



    `);

    // it should allow configuring a custom base and head via CLI args
    expect(runCLI('release plan:check --base=HEAD~1 --head=HEAD~1'))
      .toMatchInlineSnapshot(`

      NX   There are pending bumps in version plan(s)

      - "minor" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --base=HEAD~1 --head=HEAD~1 --verbose'))
      .toMatchInlineSnapshot(`

      NX   No changed files found based on resolved "base" and "head"


      NX   There are pending bumps in version plan(s)

      - "minor" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.



    `);

    // it should allow configuring a custom base and head via env vars
    expect(
      runCLI('release plan:check', {
        env: { NX_BASE: 'HEAD~1', NX_HEAD: 'HEAD~1' },
      })
    ).toMatchInlineSnapshot(`

      NX   There are pending bumps in version plan(s)

      - "minor" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(
      runCLI('release plan:check --verbose', {
        env: { NX_BASE: 'HEAD~1', NX_HEAD: 'HEAD~1' },
      })
    ).toMatchInlineSnapshot(`

      NX   No explicit --base argument provided, but found environment variable NX_BASE so using its value as the affected base: HEAD~1


      NX   No explicit --head argument provided, but found environment variable NX_HEAD so using its value as the affected head: HEAD~1


      NX   No changed files found based on resolved "base" and "head"


      NX   There are pending bumps in version plan(s)

      - "minor" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.



    `);
  });

  it('should work as expected when there are version plans on disk for multiple release groups', async () => {
    // Enable version plans and configure release groups
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        versionPlans: true,
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
          },
        },
      };
      return json;
    });

    // it should provide logs about each release group not having any touched projects
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   No touched projects found based on changed files under release group "fixed-group"


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json


      NX   No touched projects found based on changed files under release group "fixed-group"


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.



    `);

    // create a version plan which references fixed-group directly by name
    runCLI(
      `release plan patch --message "A change for fixed-group" -g fixed-group --only-touched=false`
    );

    // it should provide logs about the pending bump for fixed-group
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   Release group "fixed-group" has pending bumps in version plan(s)

      - "patch" in version-plan-{RANDOM_NUMBER}.md


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - .nx/version-plans/version-plan-{RANDOM_NUMBER}.md


      NX   Release group "fixed-group" has pending bumps in version plan(s)

      - "patch" in version-plan-{RANDOM_NUMBER}.md


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.



    `);

    // patch the version plan file to reference an individual project within the fixed-group
    patchVersionPlanFile((currentContents) =>
      currentContents.replaceAll('fixed-group', pkg1)
    );

    // it should provide logs about the pending bump for fixed-group in the same way as when the group was mentioned by name (because of the fixed relationship)
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   Release group "fixed-group" has pending bumps in version plan(s)

      - "patch" in version-plan-{RANDOM_NUMBER}.md


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - .nx/version-plans/version-plan-{RANDOM_NUMBER}.md


      NX   Release group "fixed-group" has pending bumps in version plan(s)

      - "patch" in version-plan-{RANDOM_NUMBER}.md


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.



    `);

    // should error if the independent release group is referenced directly by name in a version plan
    patchVersionPlanFile((currentContents) =>
      currentContents.replaceAll(pkg1, 'independent-group')
    );
    expect(runCLI('release plan:check', { silenceError: true }))
      .toMatchInlineSnapshot(`

      NX   Found a version bump for group 'independent-group' in 'version-plan-{RANDOM_NUMBER}.md' but the group's projects are independently versioned. Individual projects of 'independent-group' should be bumped instead.

      Pass --verbose to see the stacktrace.


    `);

    // patch the version plan file to reference one of the independent packages
    patchVersionPlanFile((currentContents) =>
      currentContents.replaceAll('independent-group', pkg3)
    );
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   No touched projects found based on changed files under release group "fixed-group"


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   Project "{project-name}" has pending bumps in version plan(s)

      - "patch" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - .nx/version-plans/version-plan-{RANDOM_NUMBER}.md


      NX   No touched projects found based on changed files under release group "fixed-group"


      NX   No touched projects found based on changed files under release group "independent-group"


      NX   Project "{project-name}" has pending bumps in version plan(s)

      - "patch" in version-plan-{RANDOM_NUMBER}.md


      NX   All touched projects have, or do not require, version plans.



    `);
  });

  it('should take "ignorePatternsForPlanCheck" into account when determining if projects are touched', async () => {
    // Enable version plans for the default release group
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        versionPlans: true,
      };
      return json;
    });

    // Update a file in pkg1
    const pkg1Dir = join(tmpProjPath(), pkg1);
    writeFileSync(join(pkg1Dir, 'file.ts'), 'const a = 1;');

    // it should show information about the missing version plan and show an error message
    expect(runCLI('release plan:check', { silenceError: true }))
      .toMatchInlineSnapshot(`

      NX   Touched projects based on changed files

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects missing version plans

      The following touched projects do not feature in any version plan files:
      - {project-name}

      Please use \`nx release plan\` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose', { silenceError: true }))
      .toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - {project-name}/file.ts


      NX   Touched projects based on changed files

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects missing version plans

      The following touched projects do not feature in any version plan files:
      - {project-name}

      Please use \`nx release plan\` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.


    `);

    // Configure ignorePatternsForPlanCheck to ignore the change in pkg1
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        versionPlans: {
          ignorePatternsForPlanCheck: ['*.ts'],
        },
      };
      return json;
    });

    // it should show information about the ignore patterns being applied and now show a success message
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   Applying configured ignore patterns to changed files

      - *.ts


      NX   No touched projects found based on changed files combined with configured ignore patterns


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - {project-name}/file.ts


      NX   Applying configured ignore patterns to changed files

      - *.ts


      NX   No touched projects found based on changed files combined with configured ignore patterns


      NX   All touched projects have, or do not require, version plans.



    `);

    // Configure release groups with no ignore patterns initially
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        versionPlans: true,
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
          },
        },
      };
      return json;
    });

    // Update a file in pkg3 to affect the independent release group as well
    const pkg3Dir = join(tmpProjPath(), pkg3);
    writeFileSync(join(pkg3Dir, 'file.css'), '.foo { color: red; }');

    // it should show information about the missing version plans and show an error message
    expect(runCLI('release plan:check', { silenceError: true }))
      .toMatchInlineSnapshot(`

      NX   Touched projects based on changed files under release group "fixed-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects missing version plans

      The following touched projects under release group "fixed-group" do not feature in any version plan files:
      - {project-name}

      Please use \`nx release plan\` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


      NX   Touched projects based on changed files under release group "independent-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects missing version plans

      The following touched projects under release group "independent-group" do not feature in any version plan files:
      - {project-name}

      Please use \`nx release plan\` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose', { silenceError: true }))
      .toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - {project-name}/file.ts
      - {project-name}/file.css


      NX   Touched projects based on changed files under release group "fixed-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects missing version plans

      The following touched projects under release group "fixed-group" do not feature in any version plan files:
      - {project-name}

      Please use \`nx release plan\` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.


      NX   Touched projects based on changed files under release group "independent-group"

      - {project-name}

      NOTE: You can adjust your "versionPlans.ignorePatternsForPlanCheck" config to stop certain files from resulting in projects being classed as touched for the purposes of this command.


      NX   Touched projects missing version plans

      The following touched projects under release group "independent-group" do not feature in any version plan files:
      - {project-name}

      Please use \`nx release plan\` to generate missing version plans, or adjust your "versionPlans.ignorePatternsForPlanCheck" config stop certain files from affecting the projects for the purposes of this command.


    `);

    // Configure release groups with different ignore patterns to each other
    updateJson<NxJsonConfiguration>('nx.json', (json) => {
      json.release = {
        groups: {
          'fixed-group': {
            projects: [pkg1, pkg2],
            versionPlans: {
              ignorePatternsForPlanCheck: ['*.ts'],
            },
          },
          'independent-group': {
            projects: [pkg3, pkg4, pkg5],
            projectsRelationship: 'independent',
            versionPlans: {
              ignorePatternsForPlanCheck: ['*.css'],
            },
          },
        },
      };
      return json;
    });

    // it should show information about the ignore patterns being applied to each one and now show a success message
    expect(runCLI('release plan:check')).toMatchInlineSnapshot(`

      NX   Applying configured ignore patterns to changed files for release group "fixed-group"

      - *.ts


      NX   No touched projects found based on changed files combined with configured ignore patterns under release group "fixed-group"


      NX   Applying configured ignore patterns to changed files for release group "independent-group"

      - *.css


      NX   No touched projects found based on changed files combined with configured ignore patterns under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.

      Run with --verbose to see the full list of changed files used for the touched projects logic.


    `);
    expect(runCLI('release plan:check --verbose')).toMatchInlineSnapshot(`

      NX   Affected criteria defaulted to --base=main --head=HEAD


      NX   Changed files based on resolved "base" ({SHASUM}) and "head" (HEAD)

      - nx.json
      - {project-name}/file.ts
      - {project-name}/file.css


      NX   Applying configured ignore patterns to changed files for release group "fixed-group"

      - *.ts


      NX   No touched projects found based on changed files combined with configured ignore patterns under release group "fixed-group"


      NX   Applying configured ignore patterns to changed files for release group "independent-group"

      - *.css


      NX   No touched projects found based on changed files combined with configured ignore patterns under release group "independent-group"


      NX   All touched projects have, or do not require, version plans.



    `);
  });
});

function patchVersionPlanFile(replacer: (currentContents: string) => string) {
  const versionPlansDir = join(tmpProjPath(), '.nx', 'version-plans');
  const versionPlanFiles = readdirSync(versionPlansDir);
  const versionPlanFilePath = join(versionPlansDir, versionPlanFiles[0]);
  const versionPlanContents = readFileSync(versionPlanFilePath, 'utf-8');
  writeFileSync(versionPlanFilePath, replacer(versionPlanContents));
}
