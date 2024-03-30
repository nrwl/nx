import { NxJsonConfiguration, ProjectConfiguration } from '@nx/devkit';
import {
  cleanupProject,
  createFile,
  killProcessAndPorts,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { execSync } from 'child_process';
import type { PackageJson } from 'nx/src/utils/package-json';

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

describe('nx release - custom npm registries', () => {
  let pkg1: string;
  let pkg2: string;
  let pkg3: string;
  let pkg4: string;
  let pkg5: string;
  let pkg6: string;
  const verdaccioPort = 7191;
  const customRegistryUrl = `http://localhost:${verdaccioPort}`;

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

    pkg6 = uniq('my-pkg-6');
    runCLI(`generate @nx/workspace:npm-package ${pkg6}`);

    updateJson<PackageJson>(`${pkg1}/package.json`, (json) => {
      json.name = `@proj/${pkg1}`;

      json.publishConfig = {
        registry: 'http://localhost:4002',
      };
      return json;
    });

    updateJson<ProjectConfiguration>(`${pkg1}/project.json`, (json) => {
      json.release = {
        version: {
          generatorOptions: {
            currentVersionResolver: 'registry',
          },
        },
      };
      return json;
    });

    updateJson<PackageJson>(`${pkg2}/package.json`, (json) => {
      json.name = `@proj/${pkg2}`;

      json.publishConfig = {
        registry: 'http://localhost:4002',
      };
      return json;
    });

    updateJson<ProjectConfiguration>(`${pkg2}/project.json`, (json) => {
      json.targets = {
        'nx-release-publish': {
          options: {
            registry: 'http://localhost:4020',
          },
        },
      };

      return json;
    });

    updateJson<PackageJson>(`${pkg3}/package.json`, (json) => {
      json.name = `@proj/${pkg3}`;
      return json;
    });

    updateJson<PackageJson>(`${pkg4}/package.json`, (json) => {
      json.name = pkg4;

      json.publishConfig = {
        registry: 'http://publish-config-registry.com',
      };

      return json;
    });

    updateJson<ProjectConfiguration>(`${pkg4}/project.json`, (json) => {
      json.release = {
        version: {
          generatorOptions: {
            currentVersionResolver: 'registry',
          },
        },
      };
      json.targets = {
        ...json.targets,
        'nx-release-publish': {
          options: {
            registry: 'http://project-config-registry.com',
          },
        },
      };
      return json;
    });

    updateJson<PackageJson>(`${pkg5}/package.json`, (json) => {
      json.name = pkg5;

      json.publishConfig = {
        registry: 'http://publish-config-registry.com',
      };

      return json;
    });

    updateJson<ProjectConfiguration>(`${pkg5}/project.json`, (json) => {
      json.targets = {
        'nx-release-publish': {
          options: {
            registry: customRegistryUrl,
            tag: 'beta',
          },
        },
      };
      json.release = {
        version: {
          generatorOptions: {
            currentVersionResolver: 'registry',
            currentVersionResolverMetadata: {
              registry: customRegistryUrl,
              tag: 'beta',
            },
          },
        },
      };

      return json;
    });

    updateJson<PackageJson>(`${pkg6}/package.json`, (json) => {
      json.name = pkg6;
      return json;
    });
  }, 60000);
  afterAll(() => cleanupProject());

  it('should respect registry configuration for each package', async () => {
    updateJson<NxJsonConfiguration>('nx.json', (nxJson) => {
      nxJson.release = {
        projectsRelationship: 'independent',
      };
      return nxJson;
    });

    const e2eRegistryUrl = execSync('npm config get registry')
      .toString()
      .trim();

    const npmrcEntries = ['@proj:registry=http://scoped-registry.com'];
    createFile('.npmrc', npmrcEntries.join('\n'));

    const publishResultScopedWithPublishConfig = runCLI(
      `release publish -p ${pkg1} --dry-run`
    );
    expect(publishResultScopedWithPublishConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "latest"'
    );

    const publishResultScopedWithPublishConfigAndProjectConfig = runCLI(
      `release publish -p ${pkg2} --dry-run`
    );
    expect(publishResultScopedWithPublishConfigAndProjectConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "latest"'
    );

    const publishResultScopedNoOtherConfig = runCLI(
      `release publish -p ${pkg3} --dry-run`
    );
    expect(publishResultScopedNoOtherConfig).toContain(
      'Would publish to http://scoped-registry.com with tag "latest"'
    );

    const publishResultScopedWithRegistryArg = runCLI(
      `release publish -p ${pkg3} --dry-run --registry=${customRegistryUrl}`
    );
    expect(publishResultScopedWithRegistryArg).toContain(
      'Would publish to http://scoped-registry.com with tag "latest"'
    );

    const publishResultNoScopeWithPublishConfigAndProjectConfig = runCLI(
      `release publish -p ${pkg4} --dry-run`
    );
    expect(publishResultNoScopeWithPublishConfigAndProjectConfig).toContain(
      'Would publish to http://publish-config-registry.com with tag "latest"'
    );

    // custom registry url will be ignored because publishConfig takes precedence
    const publishResultNoScopeWithPublishConfigAndProjectConfigAndArg = runCLI(
      `release publish -p ${pkg5} --dry-run --registry=http://ignored-registry.com`
    );
    expect(
      publishResultNoScopeWithPublishConfigAndProjectConfigAndArg
    ).toContain(
      `Would publish to http://publish-config-registry.com with tag "beta"`
    );

    const publishResultNoScope = runCLI(`release publish -p ${pkg6} --dry-run`);
    expect(publishResultNoScope).toContain(
      `Would publish to ${e2eRegistryUrl} with tag "latest"`
    );

    const publishResultNoScopeWithRegistryArg = runCLI(
      `release publish -p ${pkg6} --dry-run --registry=${customRegistryUrl}`
    );
    expect(publishResultNoScopeWithRegistryArg).toContain(
      `Would publish to ${customRegistryUrl} with tag "latest"`
    );

    runCLI(`generate setup-verdaccio`);

    const process = await runCommandUntil(
      `local-registry @proj/source --port=${verdaccioPort}`,
      (output) => output.includes(`warn --- http address`)
    );

    updateFile('.npmrc', `@proj:registry=${customRegistryUrl}\ntag=next`);

    const actualPublishResultScoped = runCLI(`release publish -p ${pkg1}`);

    updateJson<PackageJson>(`${pkg4}/package.json`, (json) => {
      json.publishConfig = {
        registry: customRegistryUrl,
      };
      return json;
    });

    const actualPublishResultNoScopeWithPublishConfig = runCLI(
      `release publish -p ${pkg4}`
    );

    updateJson<PackageJson>(`${pkg5}/package.json`, (json) => {
      delete json.publishConfig;
      return json;
    });

    const actualPublishResultNoScopeWithProjectConfig = runCLI(
      `release publish -p ${pkg5}`
    );

    const versionResultPkgs145 = runCLI(
      `release version 999.9.9 -p ${pkg1},${pkg4},${pkg5} --dry-run`,
      { silenceError: true }
    );

    await killProcessAndPorts(process.pid, verdaccioPort);

    expect(actualPublishResultScoped).toContain(
      `Published to ${customRegistryUrl} with tag "next"`
    );

    expect(actualPublishResultNoScopeWithPublishConfig).toContain(
      `Published to ${customRegistryUrl} with tag "next"`
    );

    expect(actualPublishResultNoScopeWithProjectConfig).toContain(
      `Published to ${customRegistryUrl} with tag "beta"`
    );

    expect(
      versionResultPkgs145.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "next" from registry ${customRegistryUrl}`,
          'g'
        )
      ).length
    ).toBe(2);

    expect(
      versionResultPkgs145.match(
        new RegExp(
          `Resolved the current version as 0.0.0 for tag "beta" from registry ${customRegistryUrl}`,
          'g'
        )
      ).length
    ).toBe(1);
  });
});
