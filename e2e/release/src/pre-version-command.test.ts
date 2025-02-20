import {
  cleanupProject,
  newProject,
  runCLI,
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

describe('nx release pre-version command', () => {
  let pkg1: string;

  beforeAll(() => {
    newProject({
      packages: ['@nx/js'],
    });

    pkg1 = uniq('my-pkg-1');
    runCLI(
      `generate @nx/js:library ${pkg1} --publishable --importPath=${pkg1}`
    );
  });
  afterAll(() => cleanupProject());

  it('should run pre-version command before versioning step', async () => {
    updateJson(`nx.json`, (json) => {
      delete json.release;
      return json;
    });
    const result1 = runCLI('release patch -d --first-release', {
      silenceError: true,
    });

    // command should fail because @nx/js:library configures the packageRoot to be dist/{project-name}, which doesn't exist yet
    expect(result1).toContain(
      `NX   The project "${pkg1}" does not have a package.json available at dist/${pkg1}/package.json.`
    );

    updateJson(`nx.json`, (json) => {
      json.release = {
        version: {
          preVersionCommand: 'nx run-many -t build',
        },
      };
      return json;
    });

    // command should succeed because the pre-version command will build the package
    const result2 = runCLI('release patch -d --first-release');

    expect(result2).toContain('NX   Executing pre-version command');

    const result3 = runCLI('release patch -d --first-release --verbose');

    expect(result3).toContain('NX   Executing pre-version command');
    expect(result3).toContain('Executing the following pre-version command:');
    expect(result3).toContain('nx run-many -t build');
    expect(result3).toContain(`NX   Running target build for project ${pkg1}:`);

    const groupName = uniq('group-1');
    updateJson(`nx.json`, (json) => {
      json.release = {
        groups: {
          [groupName]: {
            projects: [pkg1],
            version: {
              groupPreVersionCommand: `nx run-many -t build -p ${pkg1}`,
            },
          },
        },
      };
      return json;
    });

    // command should succeed because the pre-version command will build the package
    const result4 = runCLI(`release patch -d -g ${groupName} --first-release`);

    expect(result4).toContain(
      `NX   Executing release group pre-version command for "${groupName}"`
    );

    updateJson(`nx.json`, (json) => {
      json.release = {
        version: {
          preVersionCommand: 'echo "error" && exit 1',
        },
      };
      return json;
    });

    // command should fail because the pre-version command will fail
    const result5 = runCLI('release patch -d --first-release', {
      silenceError: true,
    });
    expect(result5).toContain(
      'NX   The pre-version command failed. Retry with --verbose to see the full output of the pre-version command.'
    );
    expect(result5).toContain('echo "error" && exit 1');

    const result6 = runCLI('release patch -d --first-release --verbose', {
      silenceError: true,
    });
    expect(result6).toContain(
      'NX   The pre-version command failed. See the full output above.'
    );
    expect(result6).toContain('echo "error" && exit 1');
  });
});
